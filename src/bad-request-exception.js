export class BadRequestException extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequestException";
  }
}
