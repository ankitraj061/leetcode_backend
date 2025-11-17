import chatService from '../services/chat.service.js';

class ChatController {
  // Handle chat message
  async sendMessage(req, res, next) {
    try {
      const { problemId } = req.params;
      const { message, conversationHistory = [] } = req.body;
      const userId = req.user?.id; // From auth middleware

      // Process chat
      const result = await chatService.processChat(
        problemId,
        message,
        conversationHistory
      );

      // Optionally save chat history
      if (userId && !result.isOffTopic) {
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: result.response }
        ];
        
        // Fire and forget - don't await
        chatService.saveChatHistory(userId, problemId, updatedHistory)
          .catch(err => console.error('Chat history save failed:', err));
      }

      res.json({
        success: true,
        data: {
          response: result.response,
          isOffTopic: result.isOffTopic,
          tokensUsed: result.tokensUsed,
          model: result.model
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get chat history for a problem
  async getChatHistory(req, res, next) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const ChatHistory = require('../models/ChatHistory');
      const history = await ChatHistory.findOne({ userId, problemId })
        .select('messages createdAt updatedAt')
        .lean();

      res.json({
        success: true,
        data: history || { messages: [] }
      });
    } catch (error) {
      next(error);
    }
  }

  // Clear chat history
  async clearChatHistory(req, res, next) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const ChatHistory = require('../models/ChatHistory');
      await ChatHistory.findOneAndDelete({ userId, problemId });

      res.json({
        success: true,
        message: 'Chat history cleared'
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ChatController();
