FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Environment variables
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=development

EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "start"]