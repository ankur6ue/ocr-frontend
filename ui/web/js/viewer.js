// https://github.com/imgix/drift

var rotateValue;
var showImageCount = document.getElementById("imageArea").getElementsByTagName('img').length;
url = 'http://127.0.0.1:30559/ocr-bff'
url = 'ocr-bff'
let log = $("#log")[0]

window.onload = function () {
    showImage(1);
    readVersion()
}

function readVersion(){
    jQuery.get('version.txt',function(data){
        $("#title")[0].innerHTML = "OCR Demo v" + data;
    });
}

// Create a global state store to keep state in event handlers
document.appLib = {}
document.appLib.boxes = null

getOCRResults = (url, file) => {
    $.get(url + '/bboxes', {'file_name': file}, function (resp) {
        if (resp.success)
            document.appLib.boxes = resp.bboxes
            document.appLib.recResults = resp.results
            document.appLib.affinity_score_map = resp.affinity_score_map
            document.appLib.connected_component_mask = resp.connected_component_mask
            document.appLib.region_score_map = resp.region_score_map
            drawImage(document.appLib.image, redraw=true)
    });
}


uploadFileToS3 = (presignedPostData, url, file) => {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        Object.keys(presignedPostData).forEach(key => {
            formData.append(key, presignedPostData[key]);
        });
        // Actual file has to be appended last.
        formData.append("file", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        // xhr.open("POST", 'ocr-bff/', true);
        xhr.send(formData);
        xhr.onload = function () {
            this.status === 204 ? resolve() : reject(this.responseText);
        };
    });
}


function loadImage() {
    $('#file-input').trigger('click');
}

function drawImage1(canvas, image, divH, divW) {
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0,0,canvas.width,canvas.height)
    imgW = image.width;
    imgH = image.height;

    if (divW > imgW && divH > imgW) {
        targetW = imgW
        targetH = imgH
    } else if (divW > imgW && divH <= imgH) {
        targetW = divH * imgW / imgH
        targetH = divH
    } else if (divH > imgH && divW <= imgW) {
        targetH = divW * imgH / imgW
        targetW = divW
    } else {
        if (imgH / imgW > divH / divW) {
            targetW = divH * imgW / imgH
            targetH = divH
        } else {
            targetH = divW * imgH / imgW
            targetW = divW
        }

    }
    offsetW = (divW - targetW) / 2
    offsetH = (divH - targetH) / 2

    ctx.drawImage(image, 0, 0, imgW, imgH, offsetW, offsetH, targetW, targetH);
                // $('#file-input')
}

function drawImage(image, redraw=false) {
    var canvas = document.getElementById('drawCanvas');
    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height) //fill the background. color is default black
    ctx.restore();
    imgW = image.width;
    imgH = image.height;
    divW = parseInt($('#imageArea')[0].style.width)
    divH = parseInt($('#imageArea')[0].style.height)
    offsetH = 0
    offsetW = 0
    targetH = divW
    targetW = divH
    ctx.drawImage(image, 0, 0, imgW, imgH, offsetW, offsetH, imgW, imgH);
    // Now draw any boxes
    if (document.appLib.boxes != undefined && document.appLib.boxes != null) {
        boxes = document.appLib.boxes
        rec_results = document.appLib.recResults
        for (let box in boxes) {
            rec_result = rec_results[box];
            coords = boxes[box].split(',');
            x = parseInt(coords[0]) * document.appLib.scaleX
            y = parseInt(coords[1]) * document.appLib.scaleY
            w = parseInt(coords[2]) * document.appLib.scaleX - x
            h = parseInt(coords[5]) * document.appLib.scaleY - y

            x = parseInt(coords[0])
            y = parseInt(coords[1])
            w = parseInt(coords[2]) - x
            h = parseInt(coords[5]) - y

            ctx.strokeRect(x, y, w, h);
            ctx.font = '20px serif';

            // Transform the position of the point we want to draw the text. If we draw the text on the original
            // image and apply the transform later, that will resize the text also, which is not what we want
            // Get transformation matrix
            const m = ctx.getTransform();
            // Apply to the position we want to draw text
            const tPt = {
                x: m.a * (x + w) + m.c * (y + 2) + m.e,
                y: m.b * (x + w) + m.d * (y + 2) + m.f,
            };
            pt = ctx.transformedPoint(x + w, y + 2)
            ctx.save();
            // Set transform to identity, because we already calculated the correct position of the text
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillText(rec_result, tPt.x, tPt.y);
            ctx.restore()
        }
    }
    if (redraw && document.appLib.connected_component_mask != null)
    {
        var diagCanvas_cc = document.getElementById('diagnosticsCanvas_cc');
        var ctx = diagCanvas_cc.getContext('2d');
        var image_cc = new Image();
        div = $('#diagnosticsArea_cc')[0]
        divW = parseInt(div.clientWidth)
        divH = parseInt(div.clientHeight)
        diagCanvas_cc.width = divW
        diagCanvas_cc.height = divH
        image_cc.onload = function () {
            drawImage1(diagCanvas_cc, image_cc, divH, divW)
        };
        image_cc.src = "data:image/png;base64,"+document.appLib.connected_component_mask
    }
    if (redraw && document.appLib.region_score_map != null)
    {
        var diagCanvas_rs = document.getElementById('diagnosticsCanvas_rs');
        var ctx = diagCanvas_rs.getContext('2d');
        var image_rs = new Image();
        div = $('#diagnosticsArea_rs')[0]
        divW = parseInt(div.clientWidth)
        divH = parseInt(div.clientHeight)
        diagCanvas_rs.width = divW
        diagCanvas_rs.height = divH
        image_rs.onload = function () {
            drawImage1(diagCanvas_rs, image_rs, divH, divW)
        };
        image_rs.src = "data:image/png;base64,"+document.appLib.region_score_map
    }

}

$('#file-input').change(function () {
    var file = this.files[0];
    document.appLib.file_name = file.name
    if (file.name.match(/\.(bmp|jpg|png)$/)) {
        var reader = new FileReader();
        reader.onload = function (e) {
            //   $('#imageScan1').attr('src', e.target.result);
            //   $('#imageScan1').style.display = '';
            var image = new Image();
            document.appLib.image = image
            // clear previous results
            document.appLib.recResults = null
            // reset transform
            var canvas = document.getElementById('drawCanvas');
            var ctx = canvas.getContext('2d');
            ctx.setTransform(1,0,0,1,0,0);
            image.onload = function (img) {
                drawImage(image)
            }
            image.src = event.target.result;
            // Also send this to S3

        }
        reader.readAsDataURL(file);
        sendToS3(file)

    } else {
        alert("File not supported, bmp/jpg/png files only");
    }
})


function sendToS3(file) {
    let fullFileName = file.name
    let fileParts = fullFileName.split('.');
    let fileName = fileParts[0];
    let fileType = fileParts[1]
    var formData = new FormData();
    formData.append('file_name', fullFileName);
    console.log("Preparing the upload");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url + '/upload_image', true);
    xhr.send(formData);
    xhr.onload = function () {
        if (this.status === 200) {
            // Received a signed URL
            console.log("success")
            response = JSON.parse(this.response)
            post_url = response.post_url
            presignedPostData = response.data
            const formData = new FormData();
            Object.keys(presignedPostData).forEach(key => {
                formData.append(key, presignedPostData[key]);
            });
            // Actual file has to be appended last.
            formData.append("file", file);
            const xhr = new XMLHttpRequest();
            xhr.open("POST", post_url, true)
            xhr.onload = function () {
                if (this.status === 204) {
                    msg = "successfully uploaded file to S3"
                    console.log(msg)
                } else {
                    msg = "error sending file to S3"
                    console.log(msg)
                }
            };
            xhr.send(formData);
        }
    }
}


function rotate(value) {
    getOCRResults(url, document.appLib.file_name)

}

function showImage(val) {
    // Set canvas height
    divW = parseInt($('#imageArea')[0].style.width)
    divH = parseInt($('#imageArea')[0].style.height)
    //create a canvas for drawing object boundaries
    const canvas = document.getElementById('drawCanvas');
    const ctx = canvas.getContext('2d');
    trackTransforms(ctx)
    canvas.width = divW
    canvas.height = divH
    var img = new Image();   // Create new img element
    img.src = 'test-image.png';
    document.appLib.file_name = 'test-image.png';
    img.onload = function (image) {
        drawImage(img)
    }
    document.appLib.image = img

    var lastX=canvas.width/2, lastY=canvas.height/2;
    var dragStart,dragged;
    canvas.addEventListener('mousedown',function(evt){
        document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragStart = ctx.transformedPoint(lastX,lastY);
        dragged = false;
    },false);
    canvas.addEventListener('mousemove',function(evt){
        lastX = evt.offsetX || (evt.pageX - canvas.offsetLeft);
        lastY = evt.offsetY || (evt.pageY - canvas.offsetTop);
        dragged = true;
        if (dragStart){
            var pt = ctx.transformedPoint(lastX,lastY);
            ctx.translate(pt.x-dragStart.x,pt.y-dragStart.y);
            drawImage(document.appLib.image)
        }
    },false);
    canvas.addEventListener('mouseup',function(evt){
			dragStart = null;
			// if (!dragged) zoom(evt.shiftKey ? -1 : 1 );
		},false);

    var scaleFactor = 1.1;
    var zoom = function(clicks){
        var pt = ctx.transformedPoint(lastX,lastY);
        ctx.translate(pt.x,pt.y);
        var factor = Math.pow(scaleFactor,clicks);
        ctx.scale(factor,factor);
        ctx.translate(-pt.x,-pt.y);
        drawImage(document.appLib.image)
    }

    var handleScroll = function(evt){
        var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
        if (delta) zoom(delta);
        return evt.preventDefault() && false;
    };
    canvas.addEventListener('DOMMouseScroll',handleScroll,false);
    canvas.addEventListener('mousewheel',handleScroll,false);
}

//
function doOCR() {
    console.log("do OCR");
    if (document.appLib.file_name == "")
    {
        alert("open an image file before running OCR")
        return
    }
    var formData = new FormData();
    formData.append('image_list', document.appLib.file_name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url + '/wf_trigger', true);
    var that = this

    xhr.onload = function () {
        if (this.status === 200) {
            resp = JSON.parse(this.response)
            if (resp.success)
                // change OCR button status to running
                $('#ocrButton').addClass('loading disabled');
                msg = "successfully created OCR job"
                console.log(msg)
                document.appLib.job_name = resp.job_name
                that.getStatusUpdates()
            } else {
                msg = "error creating OCR job"
                console.log(msg)
            }
    };
    xhr.send(formData);
    // Start long polling for status updates

}

update_scroll = function (log) {
        log.scrollTop = log.scrollHeight
    }

async function getStatusUpdates() {
    let response = await fetch(url + "/wf_update_status?&job_name=" + document.appLib.job_name);

    if (response.status == 502) {
        // Status 502 is a connection timeout error,
        // may happen when the connection was pending for too long,
        // and the remote server or a proxy closed it
        // let's reconnect
        await getStatusUpdates();
    } else if (response.status != 200) {
        // An error - let's show it
        console.log(response.statusText);
        // Reconnect in one second
        await new Promise(resolve => setTimeout(resolve, 1000));
        await getStatusUpdates();
    } else {
        // Get and show the message
        done = false
        let resp = await response.json()
        for (let status of resp.status) {
            console.log(status.status_msg)
            log.value += '\n' + status.status_msg
            update_scroll(log)
            if (status.is_completed)
            {
                 // change OCR button status to enabled again
                $('#ocrButton').removeClass('loading disabled');
                done = true
            } // get OCR results only if flow succeeded successfully
            if (status.is_completed && status.success){
                getOCRResults(url, document.appLib.file_name)
            }

            // Case where the flow failed, stop asking for updates
            if (status.is_completed && status.success == false){
                done = true
            }
        }
        if (done == false){
             // Call getStatusUpdates() again in a sec to get the next message
            await new Promise(resolve => setTimeout(resolve, 1000));
            await getStatusUpdates();
        }

    }
}
// Taken from:view-source:http://phrogz.net/tmp/canvas_zoom_to_cursor.html
function trackTransforms(ctx){
		var svg = document.createElementNS("http://www.w3.org/2000/svg",'svg');
		var xform = svg.createSVGMatrix();
		ctx.getTransform = function(){ return xform; };

		var savedTransforms = [];
		var save = ctx.save;
		ctx.save = function(){
			savedTransforms.push(xform.translate(0,0));
			return save.call(ctx);
		};
		var restore = ctx.restore;
		ctx.restore = function(){
			xform = savedTransforms.pop();
			return restore.call(ctx);
		};

		var scale = ctx.scale;
		ctx.scale = function(sx,sy){
			xform = xform.scaleNonUniform(sx,sy);
			return scale.call(ctx,sx,sy);
		};
		var rotate = ctx.rotate;
		ctx.rotate = function(radians){
			xform = xform.rotate(radians*180/Math.PI);
			return rotate.call(ctx,radians);
		};
		var translate = ctx.translate;
		ctx.translate = function(dx,dy){
			xform = xform.translate(dx,dy);
			return translate.call(ctx,dx,dy);
		};
		var transform = ctx.transform;
		ctx.transform = function(a,b,c,d,e,f){
			var m2 = svg.createSVGMatrix();
			m2.a=a; m2.b=b; m2.c=c; m2.d=d; m2.e=e; m2.f=f;
			xform = xform.multiply(m2);
			return transform.call(ctx,a,b,c,d,e,f);
		};
		var setTransform = ctx.setTransform;
		ctx.setTransform = function(a,b,c,d,e,f){
			xform.a = a;
			xform.b = b;
			xform.c = c;
			xform.d = d;
			xform.e = e;
			xform.f = f;
			return setTransform.call(ctx,a,b,c,d,e,f);
		};
		var pt  = svg.createSVGPoint();
		ctx.transformedPoint = function(x,y){
			pt.x=x; pt.y=y;
			return pt.matrixTransform(xform.inverse());
		}
	}

