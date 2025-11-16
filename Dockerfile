# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy codebase
COPY . .

# Create db directory for SQLite
RUN mkdir -p db

# Expose port
EXPOSE 8080

# Start command
CMD ["npm", "start"]

