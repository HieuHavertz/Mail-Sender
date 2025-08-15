# 📧 Email Sender Application

A modern, full-featured email sending application built with Node.js and Express. Send emails with attachments, view email history, and search through sent emails with an intuitive web interface.

## ✨ Features

- **📤 Send Emails**: Send emails with rich text content
- **📎 File Attachments**: Support for multiple file attachments (up to 5 files, 10MB each)
- **📋 Email History**: View all sent emails with pagination
- **🔍 Search Functionality**: Search emails by subject
- **💾 Persistent Storage**: JSON-based email history storage
- **🐳 Docker Support**: Easy deployment with Docker Compose
- **📱 Responsive Design**: Mobile-friendly interface
- **🔧 SMTP Configuration**: Flexible SMTP server configuration

## Screenshot demo
![](https://i.postimg.cc/ZqhLmGjR/demo.png)

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd email-sender
   ```

2. **Start the application**
    ```bash
    docker-compose up -d
    ```

3. **Configuration**

    Modify the docker-compose.yaml file: 
    ````
    - SMTP_USER=your-email@gmail.com
    - SMTP_PASS=your-app-password
    - FROM_EMAIL=your-email@gmail.com
    ````

