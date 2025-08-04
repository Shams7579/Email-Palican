const nodemailer = require('nodemailer');
const fs = require('fs');

// Read your base HTML template
let htmlTemplate = fs.readFileSync('./index.html', 'utf-8');

// Read recipients
const recipients = JSON.parse(fs.readFileSync('./email.json', 'utf-8'));

// Gmail transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'anuragino20@gmail.com',
    pass: 'pocn cwna vtfc cxqq' // Use App Password, not Gmail password
  }
});

// Function to send to one person
async function sendToPerson({ email, name }) {
  // Customize HTML (optional)
  const personalizedHtml = htmlTemplate.replace('{{name}}', name || 'Friend');

  const mailOptions = {
    from: '"Anurag Kumar" <anuragino20@gmail.com>',
    to: email,
    subject: 'Personalized HTML Email',
    html: personalizedHtml
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${email}: ${info.response}`);
  } catch (err) {
    console.error(`❌ Failed to send to ${email}:`, err.message);
  }
}

// Send to all recipients
(async () => {
  for (const person of recipients) {
    await sendToPerson(person);
  }
})();



