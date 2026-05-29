require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { getGeminiResponse } = require("./gemini");
const app = express();

app.use(express.json());

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
  const body = req.body;
  if (body.object === "whatsapp_business_account") {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message && message.type === "text") {
      const from = message.from;
      const text = message.text.body;
      console.log(`📩 Gelen: ${from}: ${text}`);

      const reply = await getGeminiResponse(text);

      await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply },
        },
        {
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
        }
      );
      console.log(`✅ Cevap gönderildi: ${reply}`);
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ RandevuAI ${PORT} portunda çalışıyor`));
