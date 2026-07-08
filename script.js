// ==========================================
// 🔴 การตั้งค่าระบบ
// ==========================================
const GOOGLE_APP_URL = "https://script.google.com/macros/s/AKfycbyceO8xYIfmc2vbz4rKiI4_CT3TUreAUGuXGoXUuR4C1WIg5QNSPzXAtQR9HDHOJG0t/exec";
const video = document.getElementById('video');
let isScanningAllowed = true;
let modelsLoaded = false; 

// 1. ฟังก์ชันโหลดโมเดลจาก CDN (เสถียรที่สุด)
async function initModels() {
    console.log("🚀 กำลังเริ่มโหลดโมเดล...");
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
    
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        modelsLoaded = true;
        console.log("✅ โมเดลโหลดสำเร็จ!");
        document.getElementById('scan-status').innerText = "✅ พร้อมใช้งาน! กดปุ่มเพื่อเริ่ม";
    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดตอนโหลดโมเดล:", err);
        document.getElementById('scan-status').innerText = "❌ โหลดโมเดลล้มเหลว";
    }
}

// 2. ฟังก์ชันเปิดกล้อง
window.startVideo = function() {
    if (!modelsLoaded) {
        alert("⏳ กำลังโหลดโมเดล... กรุณารอสักครู่");
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
    document.getElementById('scan-status').innerText = "🔍 กำลังประมวลผล...";
    
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
                document.getElementById('scan-status').innerText = "✅ เช็คชื่อ: " + studentName;
                
                // ส่งข้อมูลไป Google Sheets
                fetch(GOOGLE_APP_URL + "?student_name=" + encodeURIComponent(studentName) + "&status=boarded");

                setTimeout(() => { 
                    isScanningAllowed = true; 
                    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! รอคนต่อไป..."; 
                }, 10000);
            }
        });
    }, 1000); 
});

// 4. โหลดรูปภาพนักเรียน (ต้องมีในโฟลเดอร์ ./labeled_images)
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
                } catch (e) { console.log(`ข้าม: ${label}/${i}.jpg`); }
            }
            return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
    );
}

// 5. สั่งให้เริ่มโหลดโมเดลทันทีเมื่อหน้าเว็บพร้อม
window.addEventListener('load', initModels);
