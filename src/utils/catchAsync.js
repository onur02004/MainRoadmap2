export default fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); // Hatayı otomatik olarak global error handler'a gönderir
  };
};