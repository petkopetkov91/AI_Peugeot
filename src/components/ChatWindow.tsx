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

    // --- NEW: AbortController for timeout ---
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 15000); // 15-second timeout

    try {
      const response = await fetch(API_CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          thread_id: threadId,
        }),
        signal: controller.signal // Attach the abort signal
      });

      clearTimeout(timeoutId); // Clear the timeout if the request succeeds

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
      }
      
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
      clearTimeout(timeoutId);
      let errorText = error instanceof Error ? error.message : 'Unknown error';
      if (error instanceof Error && error.name === 'AbortError') {
        errorText = 'Заявката отне твърде дълго и беше прекратена. Моля, опитайте отново.';
      }

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