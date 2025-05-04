# استخدم نسخة خفيفة من Node.js
FROM node:20-slim

# إعداد مجلد العمل داخل الحاوية
WORKDIR /usr/src/app

# انسخ فقط ملفات تعريف الحزم أولًا (للاستفادة من التخزين المؤقت)
COPY package*.json ./

# تثبيت الحزم
RUN npm install

# نسخ باقي الملفات (بعد التثبيت لتقليل إعادة البناء)
COPY . .

# أنشئ مستخدم غير root (لأسباب أمنية)
RUN adduser --disabled-password --gecos "" appuser
RUN chown -R appuser:appuser /usr/src/app
USER appuser

# تعيين المنفذ الذي سيعمل عليه التطبيق
EXPOSE 3000

# أمر التشغيل الأساسي
CMD ["npm", "start"]
