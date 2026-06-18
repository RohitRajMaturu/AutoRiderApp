async function upload() {
  throw new Error(
    "TukTukGo upload storage is not configured. Add a project-owned upload provider before enabling file uploads.",
  );
}

export { upload };
export default upload;
