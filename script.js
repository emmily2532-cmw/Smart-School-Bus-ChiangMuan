// ==========================================
// 🔴 ตั้งค่า Google Sheets
// ==========================================
const GOOGLE_APP_URL = "https://script.google.com/macros/s/AKfycbyceO8xYIfmc2vbz4rKiI4_CT3TUreAUGuXGoXUuR4C1WIg5QNSPzXAtQR9HDHOJG0t/exec";

const video = document.getElementById('video');
let isScanningAllowed = true;
let modelsLoaded = false; 

// 1. โหลดโมเดล AI จาก Server ต้นทาง (CDN)
async function initModels() {
    console.log("🚀 กำลังเริ่มฟังก์ชันโหลดโมเดล..."); // เช็คว่าฟังก์ชันเริ่มทำงานไหม
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
    
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        console.log("✅ โหลดโมเดลจาก Server ต้นทางเรียบร้อย! modelsLoaded = " + modelsLoaded);
    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดตอนโหลดโมเดล:", err);
    }
}

// 2. ฟังก์ชันเปิดกล้อง (ใช้ window. เพื่อให้ปุ่มใน HTML เรียกใช้ได้)
window.startVideo = function() {
    if (!modelsLoaded) {
        alert("⏳ กำลังโหลดโมเดล AI... โปรดรอสักครู่");
        return;
    }
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => { 
            video.srcObject = stream; 
            document.getElementById('camera-gate').style.display = 'none'; 
            document.getElementById('main-content').style.display = 'block';
        })
        .catch(err => {
            alert("⚠️ ไม่สามารถเปิดกล้องได้: " + err);
        });
}

// 3. เริ่มสแกนเมื่อวิดีโอทำงาน
video.addEventListener('play', async () => {
    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! เริ่มสแกนได้เลย";
    
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

            if (result.label !== 'unknown' && isScanningAllowed) {
                isScanningAllowed = false;
                let studentName = result.label;
                document.getElementById('scan-status').innerText = "✅ เช็คชื่อสำเร็จ: " + studentName;
                
                fetch(GOOGLE_APP_URL + "?student_name=" + studentName + "&status=boarded");

                setTimeout(() => { 
                    isScanningAllowed = true; 
                    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! รอสแกนคนต่อไป..."; 
                }, 10000);
            }
        });
    }, 1000); 
});

// 4. โหลดรูปภาพจากโฟลเดอร์นักเรียน
async function loadLabeledImages() {
    const labels = [
        'นางสาวจุฑาทิพย์_เทพน้อย',
        'นางสาวฐิตารีย์_เกตุวีระพงศ์',
        'นายนราวิชญ์_วงค์นนทิ',
        'นายภูมินทร์_ยะแสง',
        'นายวชิรวิทย์_ชาวน่าน',
        'นายศุกลวัฒน์_กวนฮางฮอง'
    ]; 
    
    return Promise.all(
        labels.map(async label => {
            const descriptions = [];
            for (let i = 1; i <= 3; i++) { 
                try {
                    const img = await faceapi.fetchImage(`./labeled_images/${label}/${i}.jpg`);
                    const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                    if (detections) descriptions.push(detections.descriptor);
                } catch (e) { console.log(`ข้ามไฟล์: ${label}/${i}.jpg`); }
            }
            return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
    );
}
