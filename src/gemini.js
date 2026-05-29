const { GoogleGenerativeAI } = require("@google/generative-ai");

async function getGeminiResponse(userMessage) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `Sen RandevuAI'sin. Güzellik salonları için WhatsApp randevu botusun. Türkçe, kısa ve samimi cevap ver.\n\nMüşteri: ${userMessage}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { getGeminiResponse };
