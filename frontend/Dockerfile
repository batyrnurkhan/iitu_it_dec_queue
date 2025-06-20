# Вариант 1: С использованием serve (быстрое решение)
FROM node:14

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Собираем production build
RUN npm run build

# Устанавливаем serve для раздачи статики
RUN npm install -g serve

EXPOSE 3001

# Запускаем serve вместо npm start
CMD ["serve", "-s", "build", "-l", "3001"]