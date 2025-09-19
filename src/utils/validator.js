import validator from "validator";

export const validate=(data)=>{
    const mandatoryFields=['firstName',"lastName",'emailId','password'];
    const isAllowed=mandatoryFields.every((k)=>Object.keys(data).includes(k));
    if(!isAllowed) throw new Error('Missing mandatory fields');

    if(!validator.isEmail(data.emailId)) throw new Error('Invalid emailId');

    if(!validator.isStrongPassword(data.password)){
        throw new Error('Password is not strong enough');
    }
}

export const getLanguageId = (language) => {
  const lang = language.toLowerCase();
  switch (lang) {
    case "cpp": return 54;
    case "python": return 109;
    case "java": return 91;
    case "javascript": return 102;
    case "c": return 110;
    case "typescript": return 101;
    default:
      return null;
  }
};