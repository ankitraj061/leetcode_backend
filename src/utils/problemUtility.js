import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
export const submitBatch=async(submissions)=>{

const options = {
  method: 'POST',
  url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
  params: {
    base64_encoded: 'false'
  },
  headers: {
    'x-rapidapi-key': process.env.JUDGE0_API_KEY,
    'x-rapidapi-host': 'judge0-ce.p.rapidapi.com',
    'Content-Type': 'application/json'
  },
  data: {
    submissions: submissions
  }
};

async function fetchData() {
	try {
		const response = await axios.request(options);
		return response.data;
	} catch (error) {
		console.error(error);
	}
}

return await fetchData();

}

export const submitToken=async(resultToken)=>{
  const options = {
    method: 'GET',
    url: 'https://judge0-ce.p.rapidapi.com/submissions/batch',
    params: {
      tokens: resultToken.join(','),
      base64_encoded: 'false',
      fields: '*'
    },
    headers: {
      'x-rapidapi-key': process.env.JUDGE0_API_KEY,
      'x-rapidapi-host': 'judge0-ce.p.rapidapi.com'
    }
  };

  const fetchData = async () => {
    const response = await axios.request(options);
    return response.data;
  };

  while(true){
    const result = await fetchData();
    const isResultObtained = result.submissions.every(r => r.status_id > 2);

    if(isResultObtained) return result.submissions;

    await waiting(1000);
  }
}

const waiting = (time) => new Promise(resolve => setTimeout(resolve, time));


