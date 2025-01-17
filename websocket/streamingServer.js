const { LMNTStreamingClient } = require('./lmntStreaming');

const setupWebSocketServer = (wss) => {
    wss.on('connection', async (ws) => {
      console.log('New WebSocket connection established');
      let lmntClient = null;
  
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          if (!lmntClient) {
            lmntClient = new LMNTStreamingClient(process.env.LMNT_API_KEY);
            
            await lmntClient.connect({
              voice: data.voice || 'lily',
              format: 'mp3',
              sample_rate: 24000,
              speed: 1.0,
              conversational: true
            });
  
            // Set up message handler for LMNT responses
            lmntClient.ws.onmessage = (event) => {
              if (event.data instanceof Buffer || event.data instanceof ArrayBuffer) {
                ws.send(event.data);
              } else if (typeof event.data === 'string') {
                try {
                  const extras = JSON.parse(event.data);
                  if (extras.error) {
                    ws.send(JSON.stringify({ type: 'error', error: extras.error }));
                  } else {
                    ws.send(JSON.stringify({ type: 'metadata', data: extras }));
                  }
                } catch (error) {
                  console.error('Error parsing LMNT message:', error);
                }
              }
            };
          }
  
          await lmntClient.synthesize(data.text);
  
        } catch (error) {
          console.error('Streaming error:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: error.message 
          }));
        }
      });
  
      ws.on('close', () => {
        if (lmntClient) {
          lmntClient.close();
          lmntClient = null;
        }
      });
  
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (lmntClient) {
          lmntClient.close();
          lmntClient = null;
        }
      });
    });
  };

module.exports = { setupWebSocketServer };