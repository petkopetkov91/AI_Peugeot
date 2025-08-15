import os
import time
import requests
import xml.etree.ElementTree as ET
from openai import OpenAI
import json
import traceback
import re

# Променливите се зареждат от настройките на Netlify UI
api_key = os.environ.get("OPENAI_API_KEY")
assistant_id = os.environ.get("OPENAI_ASSISTANT_ID")

if not api_key or not assistant_id:
    raise ValueError("API ключовете трябва да са зададени в Netlify.")

client = OpenAI(api_key=api_key)

def parse_price(price_str):
    if not price_str: return float('inf')
    match = re.search(r'([\d\s,]+)\s*лв', price_str)
    if match:
        try:
            price_clean = match.group(1).replace(' ', '').replace(',', '.')
            return float(price_clean)
        except (ValueError, TypeError): return float('inf')
    return float('inf')

def get_available_cars(model_filter=None):
    try:
        response = requests.get("https://sale.peugeot.bg/ecommerce/fb/product_feed.xml", timeout=7) # Намален timeout
        response.raise_for_status()
        root = ET.fromstring(response.content)
        all_cars = []
        ns = {'g': 'http://base.google.com/ns/1.0'}
        for item in root.findall('.//channel/item'):
            if item.find('g:availability', ns) is not None and item.find('g:availability', ns).text == 'in stock':
                all_cars.append({
                    "model": item.find('g:title', ns).text.strip() if item.find('g:title', ns) is not None else "N/A",
                    "price": item.find('g:description', ns).text.strip() if item.find('g:description', ns) is not None else "N/A",
                    "link": item.find('g:link', ns).text if item.find('g:link', ns) is not None else "#",
                    "image_url": item.find('g:image_link', ns).text if item.find('g:image_link', ns) is not None else ""
                })
        filtered_cars = [car for car in all_cars if model_filter.lower() in car['model'].lower()] if model_filter else all_cars
        for car in filtered_cars: car['numeric_price'] = parse_price(car['price'])
        sorted_cars = sorted(filtered_cars, key=lambda x: x['numeric_price'])
        final_cars = sorted_cars[:4]
        if not final_cars:
            summary = f"За съжаление, в момента няма налични автомобили с филтър '{model_filter}'." if model_filter else "За съжаление, в момента няма налични автомобили."
            return {"summary": summary, "cars": []}
        summary = "Ето наличните автомобили, които отговарят на вашето търсене:"
        return {"summary": summary, "cars": final_cars}
    except requests.exceptions.Timeout:
        return {"summary": "Сървърът на Peugeot не отговори навреме. Моля, опитайте пак.", "cars": []}
    except Exception:
        traceback.print_exc()
        return {"summary": "Възникна грешка при извличането на данните.", "cars": []}

def handler(event, context):
    start_time = time.time()
    
    # Проверка за POST заявка
    if event['httpMethod'] != 'POST':
        return {'statusCode': 405, 'body': json.dumps({'error': 'Method Not Allowed'})}
    
    try:
        body = json.loads(event['body'])
        thread_id = body.get("thread_id")
        user_message = body.get("message")
        
        if not thread_id:
            thread = client.beta.threads.create()
            thread_id = thread.id
            
        client.beta.threads.messages.create(thread_id=thread_id, role="user", content=user_message)
        run = client.beta.threads.runs.create(assistant_id=assistant_id, thread_id=thread_id)
        
        while True:
            # Агресивна проверка за timeout
            if time.time() - start_time > 9.5:
                return {
                    'statusCode': 200, # Връщаме 200, за да не се счупи JSON парсърът
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({"response": "Заявката отне твърде дълго. Моля, задайте въпроса си отново.", "thread_id": thread_id})
                }

            run = client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            
            if run.status == 'requires_action':
                tool_call = run.required_action.submit_tool_outputs.tool_calls[0]
                if tool_call.function.name == "get_available_cars":
                    arguments = json.loads(tool_call.function.arguments)
                    model_name = arguments.get('model_filter')
                    car_data_result = get_available_cars(model_filter=model_name)
                    
                    # Потвърждаваме, за да не блокира чатът, но не чакаме
                    client.beta.threads.runs.submit_tool_outputs(
                        thread_id=thread_id, run_id=run.id,
                        tool_outputs=[{"tool_call_id": tool_call.id, "output": "Done."}]
                    )
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json'},
                        'body': json.dumps({"response": car_data_result['summary'], "cars": car_data_result['cars'], "thread_id": thread_id})
                    }

            if run.status == 'completed':
                messages = client.beta.threads.messages.list(thread_id=thread_id, order="desc", limit=1)
                response_text = messages.data[0].content[0].text.value if messages.data else "Получен е празен отговор."
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({"response": response_text, "thread_id": thread_id})
                }

            if run.status in ['failed', 'cancelled', 'expired']:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({"response": f"Грешка: Обработката спря със статус '{run.status}'.", "thread_id": thread_id})
                }

            time.sleep(0.5)

    except Exception as e:
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"error": f"Критична грешка на сървъра: {str(e)}"})
        }