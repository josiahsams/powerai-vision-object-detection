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
    if (val.includes("style")) {
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
    if (label.includes("severe")) {
        return "white";
    } else if (label.includes("moderate")) {
        return "black";
    } else {
        return "white";
    }
}

/**
 * Get the boundary box color to use given a label string.
 * @param {string} label
 * @return {string}
 */
function boundaryColor(label) {
    if (label.includes("severe")) {
        return "red";
    } else if (label.includes("moderate")) {
        return "yellow";
    } else {
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
function drawBoundaryBoxes(detectedObjects, ctx, scale=1.0) {
  ctx.lineWidth = 2;
  // ctx.font = "24px serif";

  if (detectedObjects.length > 0) {
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      const label = obj["label"];
      const color = boundaryColor(label);

      ctx.strokeStyle = color;
      const xmin = obj["xmin"]/scale;
      const ymin = obj["ymin"]/scale;
      const xmax = obj["xmax"]/scale;
      const ymax = obj["ymax"]/scale;
      ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin);

      // Now fill a rectangle at the top to put some text on.
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(xmin, ymin, xmax - xmin, 16);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = boundaryColor(label);

      var printText;
      if (label.includes("severe")) {
          printText = "Severe"
      } else if (label.includes("moderate")) {
          printText = "Moderate"
      } else {
          printText = "Low"
      }

      ctx.font = "12px Georgia Bold";
      ctx.fillText(
        obj["confidence"].toFixed(2) + " %",
        xmin + 5,
        ymin + 12
      );
    }
  }
}

function countSeverity(detectedObjects, severity) {
    if (detectedObjects.length > 0) {
        let count = 0;
        for (let i = 0; i < detectedObjects.length; i++) {
            const obj = detectedObjects[i];
            const label = obj["label"];
            if (label.includes(severity)) {
                count++;
            }
        }
        return count;
    } else {
        return 0;
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

    addRow(table, "th", ["Damage Severity", "Count"]);
    severe_count = countSeverity(detectedObjects, "severe");
    severe_cost = severe_count * 5000;
    addRow(table, "td", ["<div style='border-left: 8px solid red; padding-left: 10px'> Severe: claim range (from $5000 and above) </div>", severe_count.toString()]);
    moderate_count = countSeverity(detectedObjects, "moderate");
    moderate_cost = moderate_count * 2000;
    addRow(table, "td", ["<div style='border-left: 8px solid yellow; padding-left: 10px'>Moderate: claim range (from $2000 to $5000)</div>", moderate_count.toString()]);
    low_count = detectedObjects.length - (severe_count + moderate_count);
    low_count = low_count * 1000;
    addRow(table, "td", ["<div style='border-left: 8px solid blue; padding-left: 10px'>Minor</div>", low_count.toString()]);
    addRow(table, "td", ["<div style='font-weight: bold'>Total estimate claim cost in USD </div>", "$"+(severe_cost + moderate_cost + low_count).toString()]);

    // for (let i = 0; i < detectedObjects.length; i++) {
    //   const obj = detectedObjects[i];
    //   const label = obj["label"];
    //   // const safe = label.contains("no") ? "Down" : "Up";
    //   let safe = "<i class='far fa-thumbs-up fa-2x' style='color:green'></i>";
    //   if (label.includes("no")) {
    //     safe = "<i class='far fa-thumbs-down fa-2x' style='color:red'></i>";
    //   }
    //   addRow(table, "td", [label, safe]);
    // }
    parent.appendChild(table);
  }
}

window.addEventListener("load", function() {
  // const article = document.querySelector("#results");

  /**
   * Populate the article with formatted results.
   * @param {Object} jsonResult
   */
  function populateArticle(jsonResult, myImg, article, imgOrigWidth=0) {
    // Remove previous results
    article.innerHTML = "";

    if (jsonResult.hasOwnProperty("imageUrl")) {
      const myCanvas = document.createElement("canvas");
      const ctx = myCanvas.getContext("2d");
      ctx.canvas.height = myImg.height;
      ctx.canvas.width = myImg.width;
      console.log(myImg.width + " :: " + myImg.height);
      // ctx.drawImage(myImg, 0, 0, 1280, 720, 0, 0, myImg.width, myImg.height);
      ctx.drawImage(myImg, 0, 0, myImg.width, myImg.height);
      if (jsonResult.hasOwnProperty("classified")) {
          if (imgOrigWidth != 0) {
              drawBoundaryBoxes(jsonResult.classified, ctx, imgOrigWidth/myImg.width );
          } else {
              drawBoundaryBoxes(jsonResult.classified, ctx);
          }
      }

      myImg.setAttribute("src", myCanvas.toDataURL());
    }

    // undo it after demo
    if (jsonResult.hasOwnProperty("classified")) {
      let classified = jsonResult.classified;

      const myCount = document.createElement("h5");
      // myCount.textContent = classified.length + " objects detected";
      myCount.textContent = "Summary Report: ( " + classified.length + " ) damages detected" ;
      article.appendChild(myCount);
      // article.appendChild(document.createTextNode(countByLabel(classified)));

      detectedObjectsTable(classified, article);
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
    // canvas.width = 256;
    // canvas.height = 144;
    canvas.width = 480;
    canvas.height = 360;

    canvas
      .getContext("2d")
      .drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // get image data URL and remove canvas
    const snapshot = canvas.toDataURL("image/png");

    // JOE
    document.querySelector("#hiddengrid").setAttribute("src", snapshot);
    canvas.parentNode.removeChild(canvas);

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
        imgSrc = document.getElementById("hiddengrid").src;

        document.querySelector("#grid").setAttribute("src", snapshot);

        let rawJsonJson = JSON.parse(rawJson.data);
        // JOE

        populateArticle(
          rawJsonJson,
          document.querySelector("#grid"),
          document.querySelector("#results")
        );
      });
    // undo it after demo
    // document.querySelector("#results").innerHTML =
    //   "<div> \
    //     <div class='fa-4x'>  \
    //       <i class='fas fa-cog fa-large fa-spin'></i> \
    //     </div><br/>Uploading the image <br/>for inferencing ... </div>";
  };

  // var constraints = { audio: false, video: { width: 256, height: 144 } };
  let constraints = { audio: false, video: { width: 480, height: 360 } };
  let timer = 0;
  const timeOutFn = () => {
    capture();
    timer = setTimeout(() => timeOutFn(), 1000);
  };
  const stopTimeOutFn = () => {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  };

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
        timer = setTimeout(() => timeOutFn(), 2000);
        document.getElementById("stop").addEventListener("click", () => {
          stopVideo();
        });
        document.getElementById("stopFeed").addEventListener("click", () => {
          stopTimeOutFn();
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
      var image = new Image();
      dataURL = reader.result;
      var output = document.getElementById("uploadImg");
      image.src = dataURL;

      image.onload = function() {
          imgOrigWidth = this.width;
          imgOrigHeight = this.height;
          output.src = this.src;
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
              // imgSrc = document.getElementById("uploadImg").src;
              let rawJsonJson = JSON.parse(rawJson.data);
              populateArticle(
                rawJsonJson,
                document.querySelector("#uploadImg"),
                document.querySelector("#results2"),
                imgOrigWidth
              );

              // document.querySelector("#outPopUp").style.display = 'none';
            });
      };
      // output.src = dataURL;
    };

    // document.querySelector("#outPopUp").style.display = 'block';

    document.querySelector("#results2").innerHTML =
      "<div align='center'> \
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
