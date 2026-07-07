// ==========================================
// 🔴 ใส่ URL Web App เส้นใหม่ของคุณที่นี่อีกครั้ง
// ==========================================
const GOOGLE_APP_URL = "https://script.google.com/macros/s/AKfycbyceO8xYIfmc2vbz4rKiI4_CT3TUreAUGuXGoXUuR4C1WIg5QNSPzXAtQR9HDHOJG0t/exec";
// ==========================================

const video = document.getElementById('video');
let isScanningAllowed = true; // ตัวแปรสำหรับป้องกันการสแกนชื่อเดิมซ้ำรัวๆ

// 1. โหลดโมเดล AI (ต้องมีโฟลเดอร์ models อยู่ในที่เดียวกับเว็บ)
// เปลี่ยนบรรทัดการโหลดโมเดลจากเดิมที่เรียก ./models ให้เป็นลิงก์ CDN นี้แทนครับ
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
    faceapi.nets.faceRecognitionNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
    faceapi.nets.faceLandmark68Net.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights')
]).then(startVideo);

// 2. ฟังก์ชันเปิดกล้องหน้ารถ
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { video.srcObject = stream; })
        .catch(err => console.error("ไม่สามารถเปิดกล้องได้: ", err));
}

// 3. เริ่มสแกนเมื่อวิดีโอเล่น
video.addEventListener('play', async () => {
    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! เริ่มสแกนได้เลย";
    document.getElementById('scan-status').style.color = "#1abc9c";

    // โหลดรูปภาพต้นแบบของนักเรียน (คุณครูต้องเตรียมโฟลเดอร์รูปภาพนักเรียนไว้ตามคลิป)
    const labeledFaceDescriptors = await loadLabeledImages();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

    const canvas = document.getElementById('overlay');
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
        
        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            drawBox.draw(canvas);

            // หาก AI รู้จักใบหน้านี้ (ไม่ใช่ unknown) และระบบอนุญาตให้สแกนอยู่
            if (result.label !== 'unknown' && isScanningAllowed) {
                isScanningAllowed = false; // ล็อกระบบชั่วคราว ไม่ให้สแกนซ้ำรัวๆ
                
                let studentName = result.label;
                document.getElementById('scan-status').innerText = "✅ เช็คชื่อสำเร็จ: " + studentName;
                
                // 🚀 สั่งยิงข้อมูลชื่อนักเรียนไปที่ Google Sheets และ Telegram ทันที!
                fetch(GOOGLE_APP_URL + "?student_name=" + studentName + "&status=boarded")
                    .then(response => console.log("บันทึกข้อมูล " + studentName + " ลง Sheets สำเร็จ!"));

                // ปลดล็อกให้สแกนคนต่อไปได้ในอีก 5 วินาที
                setTimeout(() => { 
                    isScanningAllowed = true; 
                    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! รอสแกนคนต่อไป..."; 
                }, 5000);
            }
        });
    }, 100);
});

// 4. ฟังก์ชันดึงรูปภาพนักเรียนมาสอน AI (แก้ชื่อโฟลเดอร์ตามนักเรียนที่มีจริง)
function loadLabeledImages() {
    // 🔴 เปลี่ยนชื่อตรงนี้ให้ตรงกับชื่อโฟลเดอร์รูปนักเรียนของคุณครู
    const labels = ['Chuthathip'];
    
    return Promise.all(
        labels.map(async label => {
            const descriptions = [];
            for (let i = 1; i <= 2; i++) { // สมมติว่ามีรูปนักเรียนคนละ 2 รูป (1.jpg, 2.jpg)
                const img = await faceapi.fetchImage(`./labeled_images/${label}/${i}.jpg`);
                const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                descriptions.push(detections.descriptor);
            }
            return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
    );
}
