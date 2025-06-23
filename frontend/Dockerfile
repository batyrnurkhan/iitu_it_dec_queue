FROM node:14

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Используйте npm start вместо serve
CMD ["npm", "start"]