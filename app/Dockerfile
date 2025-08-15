FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY . .

# Create data directory for JSON database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
