const WebSocket = require('ws');
const { DeepgramClient } = require('./deepgramClient');

const setupDeepgramServer = (wss) => {
  wss.on('connection', (ws) => {
    console.log('New Deepgram WebSocket connection');
    let deepgramClient = null;

    ws.on('message', async (message) => {
      try {
        // Initialize Deepgram client if not exists
        if (!deepgramClient) {
          deepgramClient = new DeepgramClient(process.env.DEEPGRAM_API_KEY);
          
          // Set up transcript handler
          deepgramClient.onTranscript = (transcript) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'transcript', data: transcript }));
            }
          };

          await deepgramClient.connect();
        }

        // Send audio data to Deepgram
        deepgramClient.sendAudio(message);

      } catch (error) {
        console.error('Deepgram streaming error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: error.message 
          }));
        }
      }
    });

    ws.on('close', () => {
      if (deepgramClient) {
        deepgramClient.close();
        deepgramClient = null;
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (deepgramClient) {
        deepgramClient.close();
        deepgramClient = null;
      }
    });
  });
};

module.exports = { setupDeepgramServer };