from flask import Flask, render_template, jsonify, request
import urllib.request
import json

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/theory")
def theory():
    return render_template("theory.html")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/api/ip")
def api_ip():

    try:

        ip = request.headers.get(
            "X-Forwarded-For",
            request.remote_addr
        )

        if ip and "," in ip:
            ip = ip.split(",")[0].strip()

        if ip in ("127.0.0.1", "::1", None):
            url = "https://ipapi.co/json/"
        else:
            url = f"https://ipapi.co/{ip}/json/"

        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(
                response.read().decode("utf-8")
            )

        return jsonify({

            "success": True,

            "ip": data.get("ip"),

            "city": data.get("city"),

            "region": data.get("region"),

            "country": data.get("country_name"),

            "latitude": data.get("latitude"),

            "longitude": data.get("longitude"),

            "postal": data.get("postal"),

            "timezone": data.get("timezone"),

            "org": data.get("org")

        })

    except Exception as e:

        return jsonify({

            "success": False,

            "error": str(e)

        })


if __name__ == "__main__":

    app.run(

        host="0.0.0.0",

        port=5000,

        debug=True

    )