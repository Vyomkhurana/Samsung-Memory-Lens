import AWS from "aws-sdk";

AWS.config.update({
  region: "ap-south-1", // ✅ must match your bucket region
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();

export async function detectLabelsInBucket(bucketName) {
  let isTruncated = true;
  let continuationToken = null;
  let allFiles = [];
  let results = [];

  // 🔹 Step 1: List all files in bucket
  while (isTruncated) {
    const params = { Bucket: bucketName };
    if (continuationToken) params.ContinuationToken = continuationToken;

    const response = await s3.listObjectsV2(params).promise();
    allFiles.push(...response.Contents.map(obj => obj.Key));

    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
  }

  // 🔹 Step 2: Only keep image files
  const imageFiles = allFiles.filter(key => /\.(jpg|jpeg|png)$/i.test(key));
  console.log(`Found ${imageFiles.length} image(s) in ${bucketName}`);

  // 🔹 Step 3: Analyze each image
  for (const fileKey of imageFiles) {
    try {
      console.log("Analyzing:", fileKey);

      const rekognitionParams = {
        Image: { S3Object: { Bucket: bucketName, Name: fileKey } },
        MaxLabels: 10,
        MinConfidence: 70
      };

      const response = await rekognition.detectLabels(rekognitionParams).promise();

      results.push({
        file: fileKey,
        labels: response.Labels.map(label => ({
          name: label.Name,
          confidence: label.Confidence.toFixed(2) + "%"
        }))
      });

    } catch (err) {
      // ✅ Log specific error for debugging
      console.error(`❌ Rekognition error for ${fileKey}:`, err.message || err);
    }
  }

  return results;
}
