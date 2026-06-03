async function upload() {
  throw new Error(
    "Auto Ride upload storage is not configured. Add a project-owned upload provider before enabling file uploads.",
  );
}

export { upload };
export default upload;
