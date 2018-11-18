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
import * as tf from "@tensorflow/tfjs";
import { loadFrozenModel } from "@tensorflow/tfjs-converter";
import { CLASSES } from "./classes";

const MOBILENET_MODEL_PATH =
  "https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json";
const FINETUNE_MODEL_PATH =
  // tslint:disable-next-line:max-line-length
  "http://localhost:8081/my-model-1.json";

const COCO_MODEL_URL = "http://localhost:8081/web_model/tensorflowjs_model.pb";
const COCO_WEIGHTS_URL =
  "http://localhost:8081/web_model/weights_manifest.json";

const IMAGE_SIZE = 224;

let fineMobilenet;
let mobilenet;
let truncatedMobileNet;
let cocoMobilenet;
let isModelLoaded = false;

const loadCoco = async () => {
  console.log("cocoMobilenet start Loading");
  cocoMobilenet = tf.keep(
    await loadFrozenModel(COCO_MODEL_URL, COCO_WEIGHTS_URL)
  );
  isModelLoaded = true;
  console.log("cocoMobilenet Loaded");
};

loadCoco();

const loadTruncatedMobileNet = async () => {
  status("Loading model...");

  mobilenet = await tf.loadModel(MOBILENET_MODEL_PATH);

  fineMobilenet = await tf.loadModel(FINETUNE_MODEL_PATH);

  // Warmup the model.
  mobilenet.predict(tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3])).dispose();

  // Return a model that outputs an internal activation.
  const layer = mobilenet.getLayer("conv_pw_13_relu");
  status("");

  return tf.model({ inputs: mobilenet.inputs, outputs: layer.output });
};

const demoStatusElement = document.getElementById("status");
const status = msg => (demoStatusElement.innerText = msg);

async function init() {
  truncatedMobileNet = await loadTruncatedMobileNet();
}
let predictTimer = 0;
async function predict(imgElement) {
  if (!isModelLoaded) return 0;
  const img2 = tf.fromPixels(imgElement).toFloat();

  const predictedClass = tf.tidy(() => {
    const img = tf.image.resizeBilinear(img2, [IMAGE_SIZE, IMAGE_SIZE]);

    const offset = tf.scalar(127.5);

    // Normalize the image from [0, 255] to [-1, 1].
    const normalized = img.sub(offset).div(offset);

    // Reshape to a single-element batch so we can pass it to predict.
    const batched = normalized.reshape([1, IMAGE_SIZE, IMAGE_SIZE, 3]);

    // Make a prediction through mobilenet, getting the internal activation of
    // the mobilenet model, i.e., "embeddings" of the input images.
    const embeddings = truncatedMobileNet.predict(batched);

    // Make a prediction through our newly-trained model using the embeddings
    // from mobilenet as input.
    const predictions = fineMobilenet.predict(embeddings);

    return predictions.as1D().argMax();
  });

  const classId = (await predictedClass.data())[0];
  if (classId === 1) {
    if (predictTimer) {
      clearTimeout(predictTimer);
      countDownTimer(imgElement, 5);
    }
  }
  if (classId === 2) {
    if (predictTimer) {
      clearTimeout(predictTimer);
      document.querySelector("#results").innerHTML =
        "<center>Gesture Detection <br/><h3>Stopped !!</h3></center>";
    }
  }
  // const classId = await predictedClass.data();
  predictedClass.dispose();

  // console.log("Predicted ClassID : " + classId);

  await tf.nextFrame();
}

let feedStopAction = false;
const livePredict = async (imgElement, targetElement) => {
  if (!isModelLoaded) return 0;

  const img2 = tf.fromPixels(imgElement).toFloat();

  const im_height = img2.shape[0];
  const im_width = img2.shape[1];
  const img3 = tf.keep(img2.expandDims(0));

  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 360;

  cocoMobilenet
    .executeAsync({
      image_tensor: img3
    })
    .then(predictions => {
      const detection_boxes = predictions[0].dataSync();
      const detection_scores = predictions[1].dataSync();
      const detection_classes = predictions[2].dataSync();
      const num_detections = predictions[3].dataSync()[0];

      // console.log(
      //   "num_detections " + num_detections + " ::" + im_width + "*" + im_height
      // );
      let jsonoutput = {};
      let items = [];
      for (let i = 0; i < num_detections; i++) {
        let jsonData = {};

        jsonData["confidence"] = detection_scores[i];
        jsonData["label"] = CLASSES[detection_classes[i]].displayName;
        jsonData["ymin"] = Math.round(detection_boxes[i * 4] * im_height);
        jsonData["xmin"] = Math.round(detection_boxes[i * 4 + 1] * im_width);
        jsonData["ymax"] = Math.round(detection_boxes[i * 4 + 2] * im_height);
        jsonData["xmax"] = Math.round(detection_boxes[i * 4 + 3] * im_width);
        // console.log("Label " + jsonData["label"]);
        items.push(jsonData);
      }
      jsonoutput["classified"] = items;
      jsonoutput["result"] = "success";

      tf.dispose(img3);
      tf.dispose(img2);

      let rawJsonJson = jsonoutput;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

      if (jsonoutput.hasOwnProperty("classified")) {
        drawBoundaryBoxes(jsonoutput.classified, ctx);
      }

      targetElement.setAttribute("src", canvas.toDataURL());
    });

  tf.nextFrame();
};

function countDownTimer(imgElement, count) {
  if (count <= 0) {
    capture();
    loopPredict(imgElement);
  } else {
    setTimeout(() => {
      document.querySelector("#results").innerHTML =
        "<center>Capture Image in <br/><h2>" + count + "</h2>seconds</center>";
      count -= 1;
      countDownTimer(imgElement, count);
    }, 1000);
  }
}

function loopPredict(imgElement) {
  predictTimer = setTimeout(() => {
    predict(imgElement);
    loopPredict(imgElement);
  }, 1000);
}

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

  // console.log("labelCount : " + detectedObjects.length);
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

/**
 * Create and populate a table to show the result details.
 * @param {[]} detectedObjects
 * @param {Object} parent
 */
function detectedObjectsTable(detectedObjects, parent) {
  if (detectedObjects.length > 0) {
    const table = document.createElement("table");

    // addRow(table, "th", ["Label", "Conf", "Min Pos", "Max Pos"]);

    // addRow(table, "th", ["Items", "Safety"]);
    addRow(table, "th", ["Items"]);
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      const label = obj["label"];
      // const safe = label.contains("no") ? "Down" : "Up";

      // let safe = "<i class='far fa-thumbs-up fa-2x' style='color:green'></i>";
      // if (label.includes("no")) {
      //   safe = "<i class='far fa-thumbs-down fa-2x' style='color:red'></i>";
      // }
      addRow(table, "td", [label]);
    }
    parent.appendChild(table);
  }
}

const capture = (mode = "large", grid = "grid", results = "results") => {
  const canvas = document.createElement("canvas");
  document.querySelector("body").appendChild(canvas);

  const videoElement = document.querySelector("#videoElement");

  if (mode === "large") {
    canvas.width = 480;
    canvas.height = 360;
  } else {
    canvas.width = 256;
    canvas.height = 144;
  }

  canvas
    .getContext("2d")
    .drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // get image data URL and remove canvas
  const snapshot = canvas.toDataURL("image/jpg");

  canvas.parentNode.removeChild(canvas);

  // Load the captured image into the form data before posting
  const formData = new FormData();
  var blob = dataURLtoBlob(snapshot);
  // console.log(blob);
  formData.append("files", blob, "sample.jpg");

  // send a async post request
  fetch("./uploadpic", {
    method: "POST",
    redirect: "follow",
    body: formData
  })
    .then(response => {
      document.querySelector("#" + grid).setAttribute("src", snapshot);
      // console.log(response);
      return response.json();
    })
    .then(rawJson => {
      let rawJsonJson = JSON.parse(rawJson.data);
      populateArticle(
        rawJsonJson,
        document.querySelector("#" + grid),
        document.querySelector("#" + results)
      );
    });
  document.querySelector("#" + results).innerHTML =
    "<div> \
      <div class='fa-4x'>  \
        <i class='fas fa-cog fa-large fa-spin'></i> \
      </div><br/>Uploading the image <br/>for inferencing ... </div>";
};

/**
 * Populate the article with formatted results.
 * @param {Object} jsonResult
 */
function populateArticle(jsonResult, myImg, article = null, mode = "large") {
  // Show the image if one was returned.
  // if (jsonResult.hasOwnProperty("imageUrl")) {
  // const myImg = new Image();
  // const myImg = document.querySelector("#grid");
  // myImg.style.display = "none";

  const myCanvas = document.createElement("canvas");
  const ctx = myCanvas.getContext("2d");
  if (mode === "large") {
    ctx.canvas.height = 360;
    ctx.canvas.width = 480;
  } else {
    ctx.canvas.height = myImg.height;
    ctx.canvas.width = myImg.width;
  }

  ctx.drawImage(myImg, 0, 0, myImg.width, myImg.height);

  if (jsonResult.hasOwnProperty("classified")) {
    drawBoundaryBoxes(jsonResult.classified, ctx);
  }

  //article.appendChild(myCanvas);
  myImg.setAttribute("src", myCanvas.toDataURL());

  // document
  //   .querySelector("#grid")
  //   .setAttribute("srcObject", myImg.srcObject);

  //  myImg.src = imgSrc;
  // article.appendChild(myImg);
  // }

  if (article == null) return;

  // Remove previous results
  article.innerHTML = "";
  if (jsonResult.hasOwnProperty("classified")) {
    let classified = jsonResult.classified;

    const myCount = document.createElement("h5");
    myCount.textContent = classified.length + " objects detected";
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
    // console.log("Got Response");
    imgSrc = document.getElementById("grid").src;
    let rawContent = raw.document.body.innerText;
    let rawJson = JSON.parse(rawContent);
    let rawJsonJson = JSON.parse(rawJson.data);
    // console.log(rawJsonJson);

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

window.addEventListener("load", function() {
  // const article = document.querySelector("#results");

  var constraints = { audio: false, video: { width: 640, height: 480 } };

  let timer = 0;
  // const timeOutFn = () => {
  //   capture(mode = "small", "grid3", "results3");
  //   timer = setTimeout(() => timeOutFn(), 5000);
  // };

  const timeOutFn = () => {
    livePredict(
      document.querySelector("#videoElement"),
      document.querySelector("#grid3")
    );
    timer = setTimeout(() => timeOutFn(), 500);
    // captureFeed("large", "grid3", "results3");
    // timer = setTimeout(() => timeOutFn(), 500);
  };

  const stopTimeOutFn = () => {
    feedStopAction = true;
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
        video.width = 480;
        video.height = 360;
        localstream = stream;
        document.getElementById("capture").addEventListener("click", () => {
          capture();
        });
        document.getElementById("stop").addEventListener("click", () => {
          stopVideo();
        });
        // timer = setTimeout(() => timeOutFn(), 2000);
        document.getElementById("stop").addEventListener("click", () => {
          stopVideo();
        });
        document.getElementById("stopFeed").addEventListener("click", () => {
          stopTimeOutFn();
        });

        document.getElementById("startFeed").addEventListener("click", () => {
          timeOutFn();
        });

        // loopPredict(video);
        timer = setTimeout(() => loopPredict(video), 1000);
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
      // console.log(blob);
      formData.append("files", blob, "sample.jpg");

      // send a async post request
      fetch("./uploadpic", {
        method: "POST",
        redirect: "follow",
        body: formData
      })
        .then(response => {
          // console.log(response);
          return response.json();
        })
        .then(rawJson => {
          // imgSrc = document.getElementById("uploadImg").src;
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
  module.exports = { addRow, textColor }; // for testing
}

init();
