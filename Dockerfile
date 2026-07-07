# Étape 1 : génération du blog depuis les fichiers Markdown
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY content/ content/
COPY templates/ templates/
COPY scripts/ scripts/
RUN node scripts/build-blog.js

# Étape 2 : serveur nginx pour servir le site statique
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html cv.html coming-soon.html recherches.html documents.html datasight.html demo.html /usr/share/nginx/html/
COPY styles.css blog.css script.js i18n.js cv.css recherches.css documents.css datasight.css demo.css /usr/share/nginx/html/
COPY locales/ /usr/share/nginx/html/locales/
COPY datasight.js demo.js /usr/share/nginx/html/
COPY --from=builder /app/blog /usr/share/nginx/html/blog
    
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
