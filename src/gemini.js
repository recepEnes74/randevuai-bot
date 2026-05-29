const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function getGeminiResponse(userMessage) {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "Sen RandevuAI'sin. Güzellik salonları için WhatsApp randevu botusun. Türkçe, kısa ve samimi cevap ver.",
      },
      { role: "user", content: userMessage },
    ],
    model: "llama-3.1-8b-instant",
  });
  return completion.choices[0]?.message?.content || "Bir hata oluştu.";
}

module.exports = { getGeminiResponse };
