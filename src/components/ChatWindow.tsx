import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Plus, Car, ExternalLink } from 'lucide-react';

// Типове за данните
interface Car {
  model: string;
  price: string;
  link: string;
  image_url: string;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  cars?: Car[];
}

// Компонент за визуализация на картите с автомобили
const CarCardDisplay: React.FC<{ cars: Car[], header: string }> = ({ cars, header }) => (
  <div className="w-full">
    <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{header}</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cars.map((car, index) => (
        <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
          <img src={car.image_url} alt={car.model} className="w-full h-48 object-cover" onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null; 
            target.src = 'https://via.placeholder.com/400x300?text=Peugeot';
          }} />
          <div className="p-4">
            <h3 className="font-bold text-gray-800">{car.model}</h3>
            <p className="text-blue-600 font-semibold my-2">{car.price}</p>
            <a
              href={car.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <span>Вижте повече</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// API URL към нашата Netlify функция
const API_CHAT_ENDPOINT = "/chat";

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ефект за зареждане на чата при стартиране
  useEffect(() => {
    const savedThreadId = localStorage.getItem('threadId');
    if (savedThreadId) {
        setThreadId(savedThreadId);
    }
    
    const savedMessages = localStorage.getItem('chatHistory');
    if (savedMessages) {
      const parsedMessages: Message[] = JSON.parse(savedMessages).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      setMessages(parsedMessages);
    } else {
       const welcomeMessage: Message = {
        id: '1',
        text: 'Здравейте! Аз съм вашият Peugeot AI асистент. Попитайте ме за "налични автомобили" или за конкретен модел.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, []);

  // Ефект за запазване на чата и скролиране
  useEffect(() => {
    localStorage.setItem('chatHistory', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewChat = () => {
    localStorage.removeItem('chatHistory');
    localStorage.removeItem('threadId');
    setThreadId(null);
    setMessages([{
      id: '1',
      text: 'Здравейте! Аз съм вашият Peugeot AI асистент. Попитайте ме за "налични автомобили" или за конкретен модел.',
      isUser: false,
      timestamp: new Date(),
    }]);
  };
  
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(API_CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          thread_id: threadId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.thread_id) {
        setThreadId(data.thread_id);
        localStorage.setItem('threadId', data.thread_id);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        isUser: false,
        timestamp: new Date(),
        cars: data.cars || [],
      };
      
      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      const errorText = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Съжалявам, възникна грешка: ${errorText}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Peugeot AI асистент</h2>
              <p className="text-blue-100 text-sm">Онлайн</p>
            </div>
            <div className="flex-1"></div>
            <button
              onClick={createNewChat}
              className="text-blue-100 hover:text-white text-sm px-3 py-1 rounded-lg hover:bg-white/10 transition-colors flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Нов чат</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className="flex items-start space-x-3 max-w-2xl">
                {!message.isUser && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-600">
                     <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`rounded-2xl px-4 py-3 ${ message.isUser ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm border rounded-bl-sm'}`}>
                  {(message.cars && message.cars.length > 0) ? (
                    <CarCardDisplay cars={message.cars} header={message.text} />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  )}
                  <p className={`text-xs mt-2 text-right ${ message.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {message.isUser && (
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm border">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-gray-200">
          <div className="flex space-x-4">
            <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress}
              placeholder="Въведете съобщението си..."
              className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] max-h-32"
              rows={1} disabled={isLoading} />
            <button onClick={sendMessage} disabled={!inputMessage.trim() || isLoading}
              className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}