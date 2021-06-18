
* sudo nano /etc/nginx/sites-available/react-test
* sudo ln -s /etc/nginx/sites-available/react-test /etc/nginx/sites-enabled/
* sudo systemctl restart nginx
* edit: sudo nano /etc/hosts
* cat /etc/nginx/nginx.conf and ensure that include /etc/nginx/sites-enabled/*; is not commented

## Running as Docker
* docker run -it --rm -d --name mynginx1 -p 8800:80 -v ~/dev/apps/ML/OCR/frontend/ui:/usr/share/nginx/html nginx
* To stop the docker container
* docker stop mynginx1

## Running as Docker without volume mount
* see Dockerfile in OCR/frontend. This copies the frontend/ui directory in /usr/share/nginx/html/
* docker build -t ocr-frontend .
* docker run -it --rm -d -p 8800:80 --name mynginx1 ocr-frontend
