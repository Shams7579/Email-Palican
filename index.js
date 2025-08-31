const nodemailer = require('nodemailer');
const fs = require('fs');
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

// Database simulation (in a real app, use MongoDB, SQLite, etc.)
const trackingDB = {
  emails: {},
  opens: {},
  clicks: {},
  unsubscribes: []
};

// Read your base HTML template
let htmlTemplate = fs.readFileSync('./index.html', 'utf-8');

// Read recipients
const recipientsFilePath = './email.json';
const recipients = JSON.parse(fs.readFileSync(recipientsFilePath, 'utf-8'));

// Gmail transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'shams@pelicanessentials.com',
    pass: 'spmw zqky geyk tsqk' // Use App Password, not Gmail password
  }
});

// Tracking endpoints
app.get('/track/open/:id', (req, res) => {
  const id = req.params.id;
  if (trackingDB.emails[id]) {
    trackingDB.opens[id] = trackingDB.opens[id] || [];
    trackingDB.opens[id].push(new Date());
    console.log(`Email ${id} opened by ${trackingDB.emails[id].email}`);
  }

  // Return a 1x1 transparent pixel
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(pixel);
});

app.get('/track/click/:id/:linkId', (req, res) => {
  const { id, linkId } = req.params;
  const url = req.query.url;

  if (trackingDB.emails[id]) {
    trackingDB.clicks[id] = trackingDB.clicks[id] || {};
    trackingDB.clicks[id][linkId] = trackingDB.clicks[id][linkId] || [];
    trackingDB.clicks[id][linkId].push(new Date());
    console.log(`Link ${linkId} in email ${id} clicked by ${trackingDB.emails[id].email}`);
  }

  res.redirect(url || 'https://pelicanessentials.com');
});

app.get('/unsubscribe/:id', (req, res) => {
  const id = req.params.id;

  if (trackingDB.emails[id]) {
    const email = trackingDB.emails[id].email;
    trackingDB.unsubscribes.push(email);

    // Update the recipients file to mark as unsubscribed
    const recipients = JSON.parse(fs.readFileSync(recipientsFilePath, 'utf-8'));
    const updatedRecipients = recipients.map(r => {
      if (r.email === email) {
        return { ...r, unsubscribed: true };
      }
      return r;
    });

    fs.writeFileSync(recipientsFilePath, JSON.stringify(updatedRecipients, null, 2));

    console.log(`${email} has unsubscribed`);
    res.send(`<html><body><h1>You've been unsubscribed</h1><p>You will no longer receive emails from Pelican Essentials.</p></body></html>`);
  } else {
    res.status(404).send('Invalid unsubscribe link');
  }
});

// Start the tracking server
app.listen(PORT, () => {
  console.log(`Tracking server running on port ${PORT}`);
});

// Function to add tracking to HTML and links
function addTracking(html, trackingId, recipient) {
  // Add tracking pixel for opens
  const trackingPixel = `<img src="http://localhost:${PORT}/track/open/${trackingId}" width="1" height="1" style="display:none" alt="" />`;
  html = html.replace('</body>', `${trackingPixel}</body>`);

  // Track clicks by replacing all links
  let linkId = 0;
  html = html.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["']/gi, (match, url) => {
    const trackedUrl = `http://localhost:${PORT}/track/click/${trackingId}/${linkId}?url=${encodeURIComponent(url)}`;
    linkId++;
    return match.replace(url, trackedUrl);
  });

  // Add unsubscribe link
  const unsubscribeLink = `<p style="font-size:11px;text-align:center;margin-top:10px;"><a href="http://localhost:${PORT}/unsubscribe/${trackingId}">Unsubscribe</a></p>`;
  html = html.replace('</body>', `${unsubscribeLink}</body>`);

  return html;
}

// Function to send to one person with tracking
async function sendToPerson({ email, name, preferences = {} }) {
  // Skip if unsubscribed
  if (preferences.unsubscribed) {
    console.log(`Skipping ${email} (unsubscribed)`);
    return;
  }

  // Generate a tracking ID for this email
  const trackingId = uuidv4();
  trackingDB.emails[trackingId] = { email, name, sentAt: new Date() };

  // Customize HTML with recipient data
  let personalizedHtml = htmlTemplate;

  // Replace all placeholders
  personalizedHtml = personalizedHtml.replace(/{{name}}/g, name || 'Friend');
  personalizedHtml = personalizedHtml.replace(/{{email}}/g, email);

  // Add conditional content based on preferences
  if (preferences.interestedIn === 'sofas') {
    personalizedHtml = personalizedHtml.replace('{{special_offer}}', 'Check out our new sofa collection with 15% off!');
  } else if (preferences.interestedIn === 'dining') {
    personalizedHtml = personalizedHtml.replace('{{special_offer}}', 'New dining sets just arrived - perfect for your home!');
  } else {
    personalizedHtml = personalizedHtml.replace('{{special_offer}}', 'Explore our latest furniture collections!');
  }

  // Add tracking to HTML
  personalizedHtml = addTracking(personalizedHtml, trackingId, { email, name });

  const mailOptions = {
    from: '"Pelican Essentials" <Shams@pelicanessentials.com>',
    to: email,
    subject: 'Build Enduring Partnerships with Innovative Furniture Solutions',
    html: personalizedHtml
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${email}: ${info.response}`);
    return { success: true, trackingId };
  } catch (err) {
    console.error(`❌ Failed to send to ${email}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Send to all recipients
(async () => {
  for (const person of recipients) {
    if (!person.unsubscribed) {
      await sendToPerson(person);
    }
  }

  // Keep the server running to track opens/clicks
  console.log('All emails sent. Tracking server is running...');
})();





