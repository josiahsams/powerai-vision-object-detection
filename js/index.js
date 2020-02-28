/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* eslint-env browser */

/**
 * Add detected object info as a row in the table.
 * @param {Object} table
 * @param {string} cellType
 * @param {[]} values
 */
function addRow(table, cellType, values) {
  const row = document.createElement("tr");
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    const cell = document.createElement(cellType);
    if (val.includes("i class")) {
      // const text = document.createElement("div");
      // console.log(val);
      cell.innerHTML = val;
      // cell.appendChild(text);
    } else {
      const text = document.createTextNode(val);
      cell.appendChild(text);
    }
    row.appendChild(cell);
  }
  table.appendChild(row);
}

/**
 * Get the label text color to use given a label string.
 * @param {string} label
 * @return {string}
 */
function textColor(label) {
  switch (label) {
    case "no_glove":
      return "white";
    case "no_helmet":
      return "red";
    case "no_vest":
      return "white";
    case "glove":
      return "white";
    case "helmet":
      return "red";
    case "vest":
      return "white";
    default:
      return "cornsilk";
  }
}

function backColor(label) {
  switch (label) {
    case "no_glove":
      return "rgba(224, 34, 34, 0.5)";
    case "no_helmet":
      return "#rgba(224, 34, 34, 0.5)";
    case "no_vest":
      return "rgba(224, 34, 34, 0.5)";
    case "glove":
      return "rgba(196, 224, 34, 0.5)";
    case "helmet":
      return "rgba(196, 224, 34, 0.5)";
    case "vest":
      return "rgba(196, 224, 34, 0.5)";
    default:
      return "cornsilk";
  }
}

/**
 * Get the boundary box color to use given a label string.
 * @param {string} label
 * @return {string}
 */
function boundaryColor(label) {
  switch (label) {
    case "no_glove":
      return "red";
    case "no_helmet":
      return "silver";
    case "no_vest":
      return "black";
    case "glove":
      return "red";
    case "helmet":
      return "silver";
    case "vest":
      return "black";
    default:
      return "cornflowerblue";
  }
}

/**
 * Get a string describing how many objects or each type were detected.
 * @param {[]} detectedObjects
 * @return {string}
 */
function countByLabel(detectedObjects) {
  let countByLabel = {};
  if (detectedObjects.length > 0) {
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      const label = obj["label"];
      countByLabel[label] = (countByLabel[label] || 0) + 1;
    }
  }

  let retStrings = [];
  for (const key in countByLabel) {
    if (countByLabel.hasOwnProperty(key)) {
      retStrings.push(countByLabel[key] + " " + key); // e.g. 1 coca-cola
    }
  }
  return retStrings.join(", ");
}

/**
 * Draw boundary boxes around the detected objects.
 * @param {[]} detectedObjects
 * @param {Object} ctx
 */
function drawBoundaryBoxes(detectedObjects, ctx) {
  ctx.lineWidth = 5;
  ctx.font = "24px serif";

  if (detectedObjects.length > 0) {
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      const label = obj["label"];
      const color = boundaryColor(label);
      ctx.strokeStyle = color;
      const xmin = obj["xmin"];
      const ymin = obj["ymin"];
      const xmax = obj["xmax"];
      const ymax = obj["ymax"];
      ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);

      // Now fill a rectangle at the top to put some text on.
      ctx.fillStyle = color;
      ctx.fillRect(xmin, ymin, xmax - xmin, 25);
      ctx.fillStyle = textColor(label);
      ctx.fillText(
        label + ": " + obj["confidence"].toFixed(3),
        xmin + 5,
        ymin + 20
      );
    }
  }
}

function drawPolygons(detectedObjects, ctx) {
  ctx.lineWidth = 5;
  ctx.font = "24px serif";

  if (detectedObjects.length > 0) {
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i]["polygons"][0];
      const label = detectedObjects[i]["label"];
      ctx.fillStyle = backColor(label);
      ctx.beginPath();
      ctx.moveTo(obj[0][0], obj[0][1]);
      for (let j = 1; j < obj.length; j++) {
        ctx.lineTo(obj[j][0], obj[j][1]);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}

/**
 * Create and populate a table to show the result details.
 * @param {[]} detectedObjects
 * @param {Object} parent
 */
function detectedObjectsTable(detectedObjects, parent) {
  if (detectedObjects.length > 0) {
    const table = document.createElement("table");

    // addRow(table, "th", ["Label", "Conf", "Min Pos", "Max Pos"]);

    addRow(table, "th", ["Items", "Safety"]);
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      const label = obj["label"];
      // const safe = label.contains("no") ? "Down" : "Up";
      let safe = "<i class='far fa-thumbs-up fa-2x' style='color:green'></i>";
      if (label.includes("no")) {
        safe = "<i class='far fa-thumbs-down fa-2x' style='color:red'></i>";
      }
      addRow(table, "td", [label, safe]);
    }
    parent.appendChild(table);
  }
}

window.addEventListener("load", function() {
  // const article = document.querySelector("#results");

  /**
   * Populate the article with formatted results.
   * @param {Object} jsonResult
   */
  function populateArticle(jsonResult, myImg, article) {
    // Remove previous results
    article.innerHTML = "";

    // Show the image if one was returned.
    if (jsonResult.hasOwnProperty("imageUrl")) {
      // const myImg = new Image();
      // const myImg = document.querySelector("#grid");
      // myImg.style.display = "none";

      const myCanvas = document.createElement("canvas");
      const ctx = myCanvas.getContext("2d");
      ctx.canvas.height = myImg.height;
      ctx.canvas.width = myImg.width;
      ctx.drawImage(myImg, 0, 0, myImg.width, myImg.height);
      if (jsonResult.hasOwnProperty("classified")) {
        // drawBoundaryBoxes(jsonResult.classified, ctx);
        drawPolygons(jsonResult.classified, ctx);
      }

      //article.appendChild(myCanvas);
      myImg.setAttribute("src", myCanvas.toDataURL());

      // document
      //   .querySelector("#grid")
      //   .setAttribute("srcObject", myImg.srcObject);

      //  myImg.src = imgSrc;
      // article.appendChild(myImg);
    }

    if (jsonResult.hasOwnProperty("classified")) {
      let classified = jsonResult.classified;

      const myCount = document.createElement("h5");
      myCount.textContent = classified.length + " objects detected";
      // article.appendChild(myCount);

      // detectedObjectsTable(classified, article);
    } else {
      const myDiv = document.createElement("div");
      myDiv.className = "error";
      myDiv.id = "error-div";
      const myTitle = document.createElement("h3");
      myTitle.textContent = "ERROR";
      myDiv.appendChild(myTitle);
      // Dump keys/values to show error info
      for (const key in jsonResult) {
        if (jsonResult.hasOwnProperty(key)) {
          const myP = document.createElement("p");
          myP.textContent = key + ":  " + jsonResult[key];
          myDiv.appendChild(myP);
        }
      }
      article.appendChild(myDiv);
    }
  }

  // When upload results are loaded (hidden), use them build the results.
  const raw = top.frames["mytarget"];
  const myTarget = document.getElementById("mytarget");
  if (myTarget) {
    // optional for tests
    myTarget.addEventListener("load", function() {
      console.log("Got Response");
      imgSrc = document.getElementById("grid").src;
      let rawContent = raw.document.body.innerText;
      let rawJson = JSON.parse(rawContent);
      let rawJsonJson = JSON.parse(rawJson.data);
      console.log(rawJsonJson);

      populateArticle(rawJsonJson, imgSrc);
    });
  }

  function dataURLtoBlob(dataURL) {
    var BASE64_MARKER = ";base64,";
    if (dataURL.indexOf(BASE64_MARKER) == -1) {
      var parts = dataURL.split(",");
      var contentType = parts[0].split(":")[1];
      var raw = decodeURIComponent(parts[1]);
      return new Blob([raw], {
        type: contentType
      });
    }

    var parts = dataURL.split(BASE64_MARKER);
    var contentType = parts[0].split(":")[1];
    var raw = window.atob(parts[1]);
    var rawLength = raw.length;
    var uInt8Array = new Uint8Array(rawLength);

    for (var i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], {
      type: contentType
    });
  }

  const capture = () => {
    const canvas = document.createElement("canvas");
    document.querySelector("body").appendChild(canvas);

    const videoElement = document.querySelector("#videoElement");
    canvas.width = 480;
    canvas.height = 360;

    canvas
      .getContext("2d")
      .drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // get image data URL and remove canvas
    const snapshot = canvas.toDataURL("image/png");
    canvas.parentNode.removeChild(canvas);

    document.querySelector("#grid").setAttribute("src", snapshot);

    // Load the captured image into the form data before posting
    const formData = new FormData();
    var blob = dataURLtoBlob(snapshot);
    console.log(blob);
    formData.append("files", blob, "sample.png");

    // send a async post request
    fetch("./uploadpic", {
      method: "POST",
      redirect: "follow",
      body: formData
    })
      .then(response => {
        console.log(response);
        return response.json();
      })
      .then(rawJson => {
        imgSrc = document.getElementById("grid").src;
        let rawJsonJson = JSON.parse(rawJson.data);
        populateArticle(
          rawJsonJson,
          document.querySelector("#grid"),
          document.querySelector("#results")
        );
      });
    document.querySelector("#results").innerHTML =
      "<div> \
        <div class='fa-4x'>  \
          <i class='fas fa-cog fa-large fa-spin'></i> \
        </div><br/>Uploading the image <br/>for inferencing ... </div>";
  };

  var constraints = { audio: false, video: { width: 640, height: 480 } };

  var video = document.querySelector("#videoElement");
  var localstream;
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(function(stream) {
        video.srcObject = stream;
        localstream = stream;
        document.getElementById("capture").addEventListener("click", () => {
          capture();
        });
        document.getElementById("stop").addEventListener("click", () => {
          stopVideo();
        });
      })
      .catch(function(error) {
        console.log("Something went wrong!");
      });
  }
  function stopVideo() {
    //clearInterval(theDrawLoop);
    //ExtensionData.vidStatus = 'off';
    video.pause();
    video.src = "";
    localstream.getTracks()[0].stop();
    console.log("Camera off");
  }

  var openFile = function(event) {
    var input = event.target;
    var dataURL = null;

    var reader = new FileReader();
    reader.onload = function() {
      dataURL = reader.result;
      var output = document.getElementById("uploadImg");
      output.src = dataURL;

      // Load the captured image into the form data before posting
      const formData = new FormData();
      var blob = dataURLtoBlob(dataURL);
      console.log(blob);
      formData.append("files", blob, "sample.png");

      // send a async post request
      fetch("./uploadpic", {
        method: "POST",
        redirect: "follow",
        body: formData
      })
        .then(response => {
          console.log(response);
          return response.json();
        })
        .then(rawJson => {
          imgSrc = document.getElementById("uploadImg").src;
          let rawJsonJson = JSON.parse(rawJson.data);
          populateArticle(
            rawJsonJson,
            document.querySelector("#uploadImg"),
            document.querySelector("#results2")
          );
        });
    };
    document.querySelector("#results2").innerHTML =
      "<div> \
      <div class='fa-4x'>  \
        <i class='fas fa-cog fa-large fa-spin'></i> \
      </div><br/>Uploading the image <br/>for inferencing ... </div>";


    reader.readAsDataURL(input.files[0]);
  };

  document.getElementById("uploadfile").addEventListener("change", event => {
    openFile(event);
  });

  document
    .querySelector("#fileuploadbutton")
    .addEventListener("click", event => {
      $("#uploadfile").trigger("click");
    });
});

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
  module.exports = { addRow, textColor, populateArticle }; // for testing
}
