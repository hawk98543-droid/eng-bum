export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle the initial webhook setup route (e.g., https://your-worker.dev/set_webhook)
    if (url.pathname === '/set_webhook') {
      const botToken = '8604485452:AAFwg_AgIOeHsiXrdUYaHZXnzM7JBmoc0WE';
      const webhookUrl = `https://${url.hostname}/webhook`;
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
      const result = await response.json();
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle incoming Telegram updates
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const update = await request.json();
        
        // Check if the update contains a text message
        if (update.message && update.message.text) {
          const chatId = update.message.chat.id;
          const userText = update.message.text;
          
          // Process the message asynchronously so Cloudflare doesn't time out waiting for the API
          ctx.waitUntil(handleMessage(chatId, userText));
        }

        // Always return 200 OK to Telegram immediately so it doesn't retry sending
        return new Response('OK', { status: 200 });

      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to parse update' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Default response for other routes
    return new Response('Telegram Bot Webhook is Running!', { status: 200 });
  }
};

async function handleMessage(chatId, prompt) {
  const botToken = '8604485452:AAFwg_AgIOeHsiXrdUYaHZXnzM7JBmoc0WE';
  
  try {
    // Call the external API
    const apiResponse = await fetch(`https://m-h-m-snowy.vercel.app/chat?prompt=${encodeURIComponent(prompt)}`);
    const data = await apiResponse.json();

    let replyText = "Sorry, I couldn't get a response from the AI.";

    // Safely extract the nested response text
    if (data.status === 'success' && data.response && data.response.Response) {
      replyText = data.response.Response;
    }

    // Send the extracted text back to the Telegram chat
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        parse_mode: 'Markdown' // Helps if your API returns markdown formatting
      })
    });

  } catch (error) {
    // Fallback message if the external API fails
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "⚠️ An error occurred while contacting the AI API."
      })
    });
  }
}
