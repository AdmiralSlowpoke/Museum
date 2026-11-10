# Используем легковесный образ Nginx
FROM nginx:alpine

# Копируем всё содержимое текущей папки в директорию веб-сервера
COPY . /usr/share/nginx/html

# Открываем стандартный порт HTTP
EXPOSE 80