const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// JSON file database path
const dbPath = '/app/data/emails.json';
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize JSON database
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

// Database helper functions
const readDatabase = () => {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return [];
  }
};

const writeDatabase = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
};

const addEmail = (emailData) => {
  const emails = readDatabase();
  const newEmail = {
    id: Date.now() + Math.random(),
    ...emailData,
    sent_at: new Date().toISOString()
  };
  emails.unshift(newEmail);
  writeDatabase(emails);
  return newEmail.id;
};

const getEmails = (page = 1, limit = 10) => {
  const emails = readDatabase();
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    emails: emails.slice(startIndex, endIndex),
    total: emails.length,
    page,
    totalPages: Math.ceil(emails.length / limit)
  };
};

const getEmailById = (id) => {
  const emails = readDatabase();
  return emails.find(email => email.id == id);
};

const deleteEmailById = (id) => {
  const emails = readDatabase();
  const filteredEmails = emails.filter(email => email.id != id);
  const deleted = emails.length !== filteredEmails.length;
  if (deleted) {
    writeDatabase(filteredEmails);
  }
  return deleted;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = '/tmp/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${timestamp}-${originalName}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(jpg|jpeg|png|gif|pdf|doc|docx|txt|zip|rar|xlsx|xls|ppt|pptx)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mailhog',
  port: parseInt(process.env.SMTP_PORT) || 1025,
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined,
  tls: {
    rejectUnauthorized: false
  }
});

// Test the connection
transporter.verify((error, success) => {
  if (error) {
    console.log('SMTP connection error:', error.message);
  } else {
    console.log('SMTP server is ready');
  }
});

// Clean up uploaded files
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Cleaned up file:', filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error.message);
  }
};

// Serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    smtp_host: process.env.SMTP_HOST || 'mailhog',
    smtp_port: process.env.SMTP_PORT || 1025,
    smtp_auth: !!process.env.SMTP_USER,
    database: 'JSON file storage'
  });
});

// Get email history endpoint
app.get('/api/emails', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = getEmails(page, limit);
    
    res.json({
      success: true,
      emails: result.emails,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalEmails: result.total,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1
      }
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error' 
    });
  }
});

// Get single email details
app.get('/api/emails/:id', (req, res) => {
  try {
    const emailId = req.params.id;
    const email = getEmailById(emailId);
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    res.json(email);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete email from history
app.delete('/api/emails/:id', (req, res) => {
  try {
    const emailId = req.params.id;
    const deleted = deleteEmailById(emailId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Send email endpoint (without CC and BCC)
app.post('/api/send-email', upload.array('attachments', 5), async (req, res) => {
  const uploadedFiles = req.files || [];
  
  try {
    const { to, subject, message } = req.body;

    console.log('Sending email to:', to);
    console.log('Attachments:', uploadedFiles.length);

    // Validate input
    if (!to || !subject || !message) {
      uploadedFiles.forEach(file => cleanupFile(file.path));
      return res.status(400).json({
        success: false,
        message: 'To, subject, and message are required fields'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      uploadedFiles.forEach(file => cleanupFile(file.path));
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    // Prepare attachments
    const attachments = uploadedFiles.map(file => ({
      filename: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      path: file.path,
      contentType: file.mimetype
    }));

    // Configure email options
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'admin@localhost',
      to: to,
      subject: subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${subject}</h2>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p style="line-height: 1.6; color: #555;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          ${attachments.length > 0 ? `
            <div style="margin-top: 20px;">
              <h3 style="color: #333; font-size: 16px;">📎 Attachments (${attachments.length}):</h3>
              <ul style="color: #666;">
                ${attachments.map(att => `<li>${att.filename}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">Sent via Email Sender App</p>
        </div>
      `,
      attachments: attachments
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);

    // Save to database
    const emailData = {
      to: to,
      subject: subject,
      message: message,
      attachments: attachments.map(att => att.filename),
      messageId: info.messageId,
      status: 'sent'
    };

    const emailId = addEmail(emailData);

    // Clean up uploaded files
    uploadedFiles.forEach(file => cleanupFile(file.path));

    res.json({
      success: true,
      message: 'Email sent successfully!',
      emailId: emailId,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error sending email:', error);
    
    // Clean up files on error
    uploadedFiles.forEach(file => cleanupFile(file.path));
    
    res.status(500).json({
      success: false,
      message: 'Failed to send email: ' + error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the app at http://localhost:${PORT}`);
});
