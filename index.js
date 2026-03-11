const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json({ limit: '10mb' }));

// 配置
const CONFIG = {
  appId: 'cli_a93b3325e7785bef',
  appSecret: '9XB6vCRn77PXeApJSkY50dpeO3iZpTxW',
  encryptKey: 'ldgxxx',
  verificationToken: 'mbhgJUpr9HU8fBYuHPRRAd0u0m7ijXWu',
  botName: 'KIMI CLAW',
  kimiApiKey: process.env.KIMI_API_KEY || 'YOUR_KIMI_API_KEY'
};

// 验证签名
function verifySignature(timestamp, nonce, body, signature) {
  const content = `${timestamp}${nonce}${CONFIG.encryptKey}${body}`;
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return hash === signature;
}

// 解密消息（如果需要）
function decrypt(encryptText) {
  // 飞书加密消息处理
  // 简化版，实际需要完整AES解密
  return JSON.parse(Buffer.from(encryptText, 'base64').toString());
}

// 飞书 webhook 入口
app.post('/webhook/feishu', async (req, res) => {
  try {
    const { timestamp, nonce, encrypt } = req.body;
    
    // 解密消息
    let message;
    if (encrypt) {
      message = decrypt(encrypt);
    } else {
      message = req.body;
    }

    const { header, event } = message;
    
    // 只处理用户消息
    if (event?.message?.chat_type !== 'group' && event?.message?.chat_type !== 'p2p') {
      return res.json({ code: 0 });
    }

    const userContent = event.message.content;
    const chatId = event.message.chat_id;
    
    // 调用 Kimi API
    const kimiResponse = await callKimi(userContent);
    
    // 回复飞书
    await replyToFeishu(chatId, kimiResponse);
    
    res.json({ code: 0 });
  } catch (error) {
    console.error('Error:', error);
    res.json({ code: 0 }); // 飞书要求必须返回 0
  }
});

// 调用 Kimi API
async function callKimi(content) {
  const systemPrompt = `你是 KIMI CLAW，一位专业的保险资产管理顾问和保单分析师...`;
  
  try {
    const response = await axios.post('https://api.moonshot.cn/v1/chat/completions', {
      model: 'kimi-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${CONFIG.kimiApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    return '服务暂时不可用，请稍后重试';
  }
}

// 回复飞书消息
async function replyToFeishu(chatId, content) {
  try {
    // 获取 tenant_access_token
    const tokenRes = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: CONFIG.appId,
      app_secret: CONFIG.appSecret
    });
    
    const token = tokenRes.data.tenant_access_token;
    
    // 发送消息
    await axios.post('https://open.feishu.cn/open-apis/message/v4/send', {
      chat_id: chatId,
      msg_type: 'text',
      content: {
        text: content
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
  }
}

// 健康检查
app.get('/', (req, res) => {
  res.json({ status: 'KIMI CLAW Gateway Running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
