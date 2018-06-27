build:
	docker build . -t content-scanner
run: build
	docker run -d -p 8080:8080 content-scanner
test: build
	docker run content-scanner npm test
