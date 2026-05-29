require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { getAIResponse } = require("./gemini");
const app = express();

app.use(express.json());

// Konuşma geçmişi - her müşteri için ayrı
const conversationHistories = new Map();
const processedMessages = new Set();

app.get("/", (req, res) => {
  res.send("RandevuAI Bot çalışıyor! 🚀");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (body.object === "whatsapp_business_account") {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message && message.type === "text") {
      const msgId = message.id;
      if (processedMessages.has(msgId)) return;
      processedMessages.add(msgId);

      const from = message.from;
      const text = message.text.body;
      console.log(`📩 Gelen [${from}]: ${text}`);

      // Konuşma geçmişini al veya oluştur
      if (!conversationHistories.has(from)) {
        conversationHistories.set(from, []);
      }
      const history = conversationHistories.get(from);

      // Kullanıcı mesajını geçmişe ekle
      history.push({ role: "user", content: text });

      // Son 20 mesajı tut (bellek yönetimi)
      if (history.length > 20) history.splice(0, 2);

      try {
        const reply = await getAIResponse(history);

        // Asistan cevabını geçmişe ekle
        history.push({ role: "assistant", content: reply });

        // Randevu JSON'unu yakala
        const appointmentMatch = reply.match(
          /\{"action":"create_appointment".*?\}/
        );
        if (appointmentMatch) {
          const appointment = JSON.parse(appointmentMatch[0]);
          appointment.phone = from;
          console.log("📅 YENİ RANDEVU:", appointment);
          // TODO: Google Calendar entegrasyonu buraya gelecek
        }

        // Temiz mesaj gönder (JSON kısmını çıkar)
        const cleanReply = reply.replace(/\{"action":.*?\}/g, "").trim();

        await axios.post(
          `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: cleanReply },
          },
          { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
        );
        console.log(`✅ Cevap gönderildi: ${cleanReply}`);
      } catch (err) {
        console.error("❌ Hata:", err.response?.data || err.message);
      }
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ RandevuAI ${PORT} portunda çalışıyor`));
