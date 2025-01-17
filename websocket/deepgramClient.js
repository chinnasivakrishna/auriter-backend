const WebSocket = require('ws');

class DeepgramClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.onTranscript = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket('wss://api.deepgram.com/v1/listen', {
          headers: {
            Authorization: `Token ${this.apiKey}`
          }
        });

        this.ws.onopen = () => {
          console.log('Connected to Deepgram');
          resolve();
        };

        this.ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives?.[0]?.transcript && this.onTranscript) {
            this.onTranscript(data.channel.alternatives[0].transcript);
          }
        };

        this.ws.onerror = (error) => {
          console.error('Deepgram connection error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('Deepgram connection closed');
        };

      } catch (error) {
        console.error('Error connecting to Deepgram:', error);
        reject(error);
      }
    });
  }

  sendAudio(audioData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = { DeepgramClient };