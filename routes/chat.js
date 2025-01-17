const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const { OpenAI } = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Get chat history
router.get('/history/:userId', async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.params.userId })
      .sort({ updatedAt: -1 })
      .limit(10);
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Process message and get AI response
router.post('/message', async (req, res) => {
  try {
    const { userId, message } = req.body;

    let chat = await Chat.findOne({ userId });
    if (!chat) {
      chat = new Chat({ userId, messages: [] });
    }

    chat.messages.push({
      content: message,
      isUser: true,
      timestamp: new Date()
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: message }
      ],
      max_tokens: 500
    });

    const aiResponse = completion.choices[0].message.content;

    chat.messages.push({
      content: aiResponse,
      isUser: false,
      timestamp: new Date()
    });

    chat.updatedAt = Date.now();
    await chat.save();

    res.json({
      message: aiResponse,
      chatHistory: chat.messages
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete chat history
router.delete('/history/:userId', async (req, res) => {
  try {
    await Chat.deleteMany({ userId: req.params.userId });
    res.json({ message: 'Chat history deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat history:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;