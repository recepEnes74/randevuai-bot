const axios = require("axios");

async function getGeminiResponse(userMessage) {
  const apiKey = process.env.GEMINI_API_KEY;

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      contents: [
        {
          parts: [
            {
              text: `Sen RandevuAI'sin. Güzellik salonları için WhatsApp randevu botusun. Türkçe, kısa ve samimi cevap ver.\n\nMüşteri: ${userMessage}`,
            },
          ],
        },
      ],
    }
  );

  return response.data.candidates[0].content.parts[0].text;
}

module.exports = { getGeminiResponse };
