// Store selected files globally
let selectedFiles = [];

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Check if all required elements exist
    const requiredElements = [
        'emailForm',
        'attachments', 
        'fileList',
        'statusMessage',
        'searchInput',
        'emailList',
        'pagination'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        return;
    }
    
    // Initialize event listeners
    setupEventListeners();
    
    // Load emails
    loadEmails();
}

function setupEventListeners() {
    // Email form handling
    document.getElementById('emailForm').addEventListener('submit', handleFormSubmit);
    
    // File upload handling
    document.getElementById('attachments').addEventListener('change', handleFileSelection);
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', handleSearch);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    
    // Add form fields
    formData.append('to', document.getElementById('to').value);
    formData.append('subject', document.getElementById('subject').value);
    formData.append('message', document.getElementById('message').value);
    
    // Add all selected files
    selectedFiles.forEach(file => {
        formData.append('attachments', file);
    });
    
    const submitButton = document.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    const statusMessage = document.getElementById('statusMessage');
    
    // Show loading state
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;
    statusMessage.innerHTML = '<div class="status loading">📤 Sending email...</div>';
    
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            statusMessage.innerHTML = '<div class="status success">✅ Email sent successfully!</div>';
            document.getElementById('emailForm').reset();
            selectedFiles = []; // Clear selected files
            updateFileDisplay();
            loadEmails(); // Refresh email list
            
            // Clear success message after 3 seconds
            setTimeout(() => {
                statusMessage.innerHTML = '';
            }, 3000);
        } else {
            statusMessage.innerHTML = `<div class="status error">❌ Error: ${result.error}</div>`;
        }
    } catch (error) {
        statusMessage.innerHTML = `<div class="status error">❌ Error sending email: ${error.message}</div>`;
    } finally {
        // Reset button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

function handleFileSelection(e) {
    const newFiles = Array.from(e.target.files);
    
    // Add new files to existing selection
    newFiles.forEach(file => {
        // Check if file already exists (by name and size)
        const exists = selectedFiles.some(existingFile => 
            existingFile.name === file.name && existingFile.size === file.size
        );
        
        if (!exists) {
            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                alert(`File ${file.name} is too large. Maximum size is 10MB.`);
                return;
            }
            
            selectedFiles.push(file);
        }
    });
    
    // Check total file count
    if (selectedFiles.length > 5) {
        alert('Maximum 5 files allowed. Keeping first 5 files.');
        selectedFiles = selectedFiles.slice(0, 5);
    }
    
    // Clear the input to allow selecting the same file again if needed
    e.target.value = '';
    
    // Update display
    updateFileDisplay();
}

// Function to update file display
function updateFileDisplay() {
    const fileList = document.getElementById('fileList');
    if (!fileList) {
        console.error('fileList element not found');
        return;
    }
    
    fileList.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        return;
    }
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-name">📎 ${file.name}</span>
                <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <button type="button" class="remove-file-btn" onclick="removeFile(${index})">
                ❌
            </button>
        `;
        fileList.appendChild(fileItem);
    });
    
    // Show total files info
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const totalInfo = document.createElement('div');
    totalInfo.className = 'files-total';
    totalInfo.innerHTML = `
        <strong>Total: ${selectedFiles.length} file(s) - ${(totalSize / 1024 / 1024).toFixed(2)} MB</strong>
    `;
    fileList.appendChild(totalInfo);
}

// Function to remove a specific file
function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileDisplay();
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const emailItems = document.querySelectorAll('.email-item');
    
    emailItems.forEach(item => {
        const subject = item.querySelector('h4');
        if (subject && subject.textContent.toLowerCase().includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Load and display emails
async function loadEmails(page = 1) {
    try {
        const response = await fetch(`/api/emails?page=${page}&limit=10`);
        const data = await response.json();
        
        displayEmails(data.emails);
        displayPagination(data.pagination);
    } catch (error) {
        console.error('Error loading emails:', error);
        const emailList = document.getElementById('emailList');
        if (emailList) {
            emailList.innerHTML = '<div class="error-message">❌ Error loading emails</div>';
        }
    }
}

function displayEmails(emails) {
    const emailList = document.getElementById('emailList');
    if (!emailList) {
        console.error('emailList element not found');
        return;
    }
    
    emailList.innerHTML = '';
    
    if (!emails || emails.length === 0) {
        emailList.innerHTML = '<div class="no-emails">📭 No emails found</div>';
        return;
    }
    
    emails.forEach(email => {
        const emailItem = document.createElement('div');
        emailItem.className = 'email-item';
        emailItem.innerHTML = `
            <div class="email-header">
                <h4>${email.subject || 'No Subject'}</h4>
                <span class="email-date">${new Date(email.sent_at).toLocaleString()}</span>
            </div>
            <p class="email-to"><strong>To:</strong> ${email.to}</p>
            <p class="email-preview">${(email.message || '').substring(0, 150)}${(email.message || '').length > 150 ? '...' : ''}</p>
            ${email.attachments && email.attachments.length > 0 ? 
                `<div class="attachments-info">📎 ${email.attachments.length} attachment(s): ${email.attachments.map(att => att.filename || 'Unknown').join(', ')}</div>` : 
                ''
            }
            <div class="email-actions">
                <button class="delete-btn" onclick="deleteEmail('${email.id}')">🗑️ Delete</button>
            </div>
        `;
        emailList.appendChild(emailItem);
    });
}

function displayPagination(pagination) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) {
        console.error('pagination element not found');
        return;
    }
    
    paginationDiv.innerHTML = '';
    
    if (!pagination || pagination.totalPages <= 1) return;
    
    // Previous button
    if (pagination.currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.textContent = '← Previous';
        prevBtn.onclick = () => loadEmails(pagination.currentPage - 1);
        paginationDiv.appendChild(prevBtn);
    }
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
    paginationDiv.appendChild(pageInfo);
    
    // Next button
    if (pagination.currentPage < pagination.totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.textContent = 'Next →';
        nextBtn.onclick = () => loadEmails(pagination.currentPage + 1);
        paginationDiv.appendChild(nextBtn);
    }
}

// Delete email function
async function deleteEmail(emailId) {
    if (!confirm('Are you sure you want to delete this email?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/emails/${emailId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadEmails(); // Refresh the list
        } else {
            alert('Error deleting email');
        }
    } catch (error) {
        alert('Error deleting email: ' + error.message);
    }
}
