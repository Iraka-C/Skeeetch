import serial
import math
import time
import webbrowser
import threading
import logging
from flask import Flask, jsonify, send_from_directory


# url = "www.google.com"
# webbrowser.open(url, new=2)

## ================ Initial Settings ================
# Server & Serial Client
app = None

## ================ Web server =======================
def main():
	global app, ser, serRunning
	app = Flask(__name__, static_url_path="/gl")
	#log = logging.getLogger('werkzeug') # Disable logger
	#log.setLevel(logging.ERROR)

	# Set Router
	@app.route('/<path:path>')
	def sendStatic(path):
		return send_from_directory("gl",path)


## =============== Threads =================
if __name__ == "__main__":
	main()
	def threadApp():
		app.run()
	t1 = threading.Thread(target=threadApp)
	t1.setDaemon(True)
	t1.start()

# Daemon Thread
try:
	while True:
		time.sleep(10)
except KeyboardInterrupt:
	print("\n\n[Ctrl+C] Interrupted")
	exit(0)