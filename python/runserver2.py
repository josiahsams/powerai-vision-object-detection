import tensorflow as tf
import numpy as np
import sys
from PIL import Image
from flask import Flask, jsonify, request
import json
import tempfile
#import urllib.request
import urllib
import os
from werkzeug import secure_filename


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = './tmp'


def load_graph(model_file):
    graph = tf.Graph()
    graph_def = tf.GraphDef()

    with open(model_file, "rb") as f:
        graph_def.ParseFromString(f.read())
    with graph.as_default():
        tf.import_graph_def(graph_def)

    return graph


def read_tensor_from_image_file(file_name,
                                input_height=299,
                                input_width=299,
                                input_mean=0,
                                input_std=255):
    input_name = "file_reader"
    output_name = "normalized"
    # file_reader = tf.read_file(file_name, input_name)
    file_reader = tf.read_file(file_name, input_name)
    if file_name.endswith(".png"):
        image_reader = tf.image.decode_png(
            file_reader, channels=3, name="png_reader")
    elif file_name.endswith(".gif"):
        image_reader = tf.squeeze(
            tf.image.decode_gif(file_reader, name="gif_reader"))
    elif file_name.endswith(".bmp"):
        image_reader = tf.image.decode_bmp(file_reader, name="bmp_reader")
    else:
        image_reader = tf.image.decode_jpeg(
            file_reader, channels=3, name="jpeg_reader")
    float_caster = tf.cast(image_reader, tf.float32)
    dims_expander = tf.expand_dims(float_caster, 0)
    resized = tf.image.resize_bilinear(
        dims_expander, [input_height, input_width])
    normalized = tf.divide(tf.subtract(resized, [input_mean]), [input_std])
    sess = tf.Session()
    result = sess.run(normalized)

    return result

def load_image_into_numpy_array(image):
  (im_width, im_height) = image.size
  new_img = image.convert(mode='RGB')
  print("Image size: {} {}".format(im_width, im_height))
  print(" {} :: {} ".format(np.array(image).shape , np.array(new_img).shape))
  # return np.array(image.getdata()).reshape(
  return np.asarray(new_img).reshape(
      (im_height, im_width, 3)).astype(np.uint8)


def load_labels(label_file):
    label = []
    proto_as_ascii_lines = tf.gfile.GFile(label_file).readlines()
    for l in proto_as_ascii_lines:
        label.append(l.rstrip())
    return label


def run_inference_for_single_image(image, graph):
  with graph.as_default():
    with tf.Session() as sess:
      # Get handles to input and output tensors
      ops = tf.get_default_graph().get_operations()
      all_tensor_names = {output.name for op in ops for output in op.outputs}
      tensor_dict = {}
      for key in [
          'num_detections', 'detection_boxes', 'detection_scores',
          'detection_classes', 'detection_masks'
      ]:
        tensor_name = 'import/'+ key + ':0'
        if tensor_name in all_tensor_names:
          tensor_dict[key] = tf.get_default_graph().get_tensor_by_name(
              tensor_name)


      if 'detection_masks' in tensor_dict:
        # The following processing is only for single image
        detection_boxes = tf.squeeze(tensor_dict['detection_boxes'], [0])
        detection_masks = tf.squeeze(tensor_dict['detection_masks'], [0])
        # Reframe is required to translate mask from box coordinates to image coordinates and fit the image size.
        real_num_detection = tf.cast(tensor_dict['num_detections'][0], tf.int32)
        detection_boxes = tf.slice(detection_boxes, [0, 0], [real_num_detection, -1])
        detection_masks = tf.slice(detection_masks, [0, 0, 0], [real_num_detection, -1, -1])
        detection_masks_reframed = utils_ops.reframe_box_masks_to_image_masks(
            detection_masks, detection_boxes, image.shape[0], image.shape[1])
        detection_masks_reframed = tf.cast(
            tf.greater(detection_masks_reframed, 0.5), tf.uint8)
        # Follow the convention by adding back the batch dimension
        tensor_dict['detection_masks'] = tf.expand_dims(
            detection_masks_reframed, 0)
      image_tensor = tf.get_default_graph().get_tensor_by_name('import/image_tensor:0')

      # Run inference
      output_dict = sess.run(tensor_dict,
                             feed_dict={image_tensor: np.expand_dims(image, 0)})

      # all outputs are float32 numpy arrays, so convert types as appropriate
      output_dict['num_detections'] = int(output_dict['num_detections'][0])
      output_dict['detection_classes'] = output_dict[
          'detection_classes'][0].astype(np.uint8)
      output_dict['detection_boxes'] = output_dict['detection_boxes'][0]
      output_dict['detection_scores'] = output_dict['detection_scores'][0]
      if 'detection_masks' in output_dict:
        output_dict['detection_masks'] = output_dict['detection_masks'][0]
  return output_dict

@app.route('/', methods = ['GET', 'POST'])
def index():
    file_name = ""
    if request.method == 'POST':
        f = request.files['files']
        filename = secure_filename(f.filename)
        file_name = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        f.save(file_name)

    elif request.method == 'GET':
        tmp = tempfile.NamedTemporaryFile()
        print("Create a new file " + tmp.name)
        url = request.args.get('url')

        file_name = ""
        try:
            # urllib.request.urlretrieve(url, tmp.name)
            urllib.urlretrieve(url, tmp.name)
            file_name = tmp.name
        except Exception as e:
            print(str(e))
            if os.path.isfile(file_name):
                os.remove(file_name)
            response = jsonify("exception raised: {}". format(str(e)))
            response.status_code = 500
            return response

    image = Image.open(file_name)
    (im_width, im_height) = image.size
    image_np = load_image_into_numpy_array(image)

    out_dict = run_inference_for_single_image(image_np, graph)
    # print(out_dict)

    finalresult={}
    predList = []
    for item in range(0, out_dict['num_detections']):
        res = {}
        res["label"] = category[str(out_dict['detection_classes'][item])]
        res["confidence"] = int(out_dict['detection_scores'][item] * 100)

   #     res["xmin"] = int(out_dict['detection_boxes'][item][0] * im_height)
   #     res["ymin"] = int(out_dict['detection_boxes'][item][1] * im_width)
   #     res["xmax"] = int(out_dict['detection_boxes'][item][2] * im_height)
   #     res["ymax"] = int(out_dict['detection_boxes'][item][3] * im_width)

        res["ymin"] = int(out_dict['detection_boxes'][item][0] * im_height)
        res["xmin"] = int(out_dict['detection_boxes'][item][1] * im_width)
        res["ymax"] = int(out_dict['detection_boxes'][item][2] * im_height)
        res["xmax"] = int(out_dict['detection_boxes'][item][3] * im_width)
        # res["boxes"] = ["%d" % (x * 100) for x in out_dict['detection_boxes'][item].tolist()]
        print("Detected - {} \n Accuracy - {} \n Boxes : {}*{} {}*{} \n ".format(category[str(out_dict['detection_classes'][item])],
                                        out_dict['detection_scores'][item],
                                        res["ymin"], res["xmin"], res["ymax"], res["xmax"]))
        predList.append(res)

    finalresult["classified"] = predList
    finalresult["result"] = "success"
    print(finalresult)
    return jsonify(finalresult)


if __name__ == '__main__':
    input_height = 299
    input_width = 299
    input_mean = 0
    input_std = 255
    file_name="./data/dog.jpg"
    model_file = "./model/frozen_inference_graph.pb"
    label_file = "./model/labels"
    index_file = "./model/label_indexes"

    graph = load_graph(model_file)

    # writer = tf.summary.FileWriter('./graphs', graph)

    # print(graph.get_operations())
    category = {}
    indx = 1
    with open(label_file) as f:
        content = f.readlines()

    with open(index_file) as f:
        indexes = f.readlines()

    for x,indx in zip(content, indexes):
        indx = indx.strip()
        entry = x.strip()
        category[indx] = entry

    # print(category)

    # img = read_tensor_from_image_file(
            #     file_name,
            #     input_height=input_height,
            #     input_width=input_width,
            #     input_mean=input_mean,
            #     input_std=input_std)

    app.run(host='0.0.0.0', port=8888, debug=True)

