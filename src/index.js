require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { getAIResponse } = require("./gemini");

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const conversationHistories = new Map();
const processedMessages = new Set();

app.get("/", (req, res) => res.send("RandevuAI Bot çalışıyor! 🚀"));

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

      // Konuşma geçmişi
      if (!conversationHistories.has(from)) conversationHistories.set(from, []);
      const history = conversationHistories.get(from);
      history.push({ role: "user", content: text });
      if (history.length > 20) history.splice(0, 2);

      // Mesajı Supabase'e kaydet
      try {
        await supabase.from("mesajlar").insert([
          {
            whatsapp_telefon: from,
            yon: "gelen",
            icerik: text,
            mesaj_tipi: "text",
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (e) {
        console.log("Mesaj kayıt hatası:", e.message);
      }

      try {
        const reply = await getAIResponse(history);
        history.push({ role: "assistant", content: reply });

        // Randevu JSON'unu yakala ve kaydet
        const aptMatch = reply.match(/\{"action":"create_appointment".*?\}/);
        if (aptMatch) {
          try {
            const apt = JSON.parse(aptMatch[0]);
            apt.phone = from;
            console.log("📅 YENİ RANDEVU:", apt);

            // Müşteriyi bul veya oluştur
            let { data: musteri } = await supabase
              .from("musteriler")
              .select("id")
              .eq("whatsapp_telefon", from)
              .single();

            if (!musteri) {
              const { data: yeniMusteri } = await supabase
                .from("musteriler")
                .insert([
                  {
                    whatsapp_telefon: from,
                    ad: apt.name || "Müşteri",
                    created_at: new Date().toISOString(),
                  },
                ])
                .select()
                .single();
              musteri = yeniMusteri;
            }

            // Randevuyu kaydet
            await supabase.from("randevular").insert([
              {
                musteri_adi: apt.name,
                whatsapp_telefon: from,
                hizmet_adi: apt.service,
                tarih: apt.date,
                saat: apt.time,
                durum: "bekliyor",
                created_at: new Date().toISOString(),
              },
            ]);

            console.log("✅ Randevu Supabase'e kaydedildi!");
          } catch (e) {
            console.log("Randevu kayıt hatası:", e.message);
          }
        }

        // Cevap mesajını kaydet
        const cleanReply = reply.replace(/\{"action":.*?\}/g, "").trim();

        try {
          await supabase.from("mesajlar").insert([
            {
              whatsapp_telefon: from,
              yon: "giden",
              icerik: cleanReply,
              mesaj_tipi: "text",
              created_at: new Date().toISOString(),
            },
          ]);
        } catch (e) {
          console.log("Cevap kayıt hatası:", e.message);
        }

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
