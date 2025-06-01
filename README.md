## API Documentation Skill-seed-ai-backend

``Base URL``

http://localhost:3000/api

Authentication
Most endpoints require a Bearer token in the Authorization header. Example:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

## Endpoints

### User Management

### Get My Profile

`Method: GET`

`Path: /users/me`

``Authorization: Required (Bearer token) ``

_Description: Retrieves the authenticated user's profile 
information.
Response: User profile data (JSON)_

### Get All Users

`Method: GET`

`Path: /users/all`

`Authorization: Not required`

Description: Retrieves a list of all users.

_Response: Array of user objects (JSON)_

### Register a Student

`Method: POST`

`Path: /auth/register`

`Content-Type: application/json`

`Authorization: Not required`

Description: Creates a new student account.

___Request Body:{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "age": number,
  "role": "student",
  "password": "string"
}___


Response: Newly created user object (JSON)

### Sign In a Student

`Method: POST`
`Path: /auth/signin`
`Content-Type: application/json`
`Authorization: Not required`

Description: Authenticates a student and returns a token.
_Request Body:{
  "firstName": "string",
  "password": "string"
}_


` Response: Authentication token (JSON)`

>Quiz Management

>Get All Quizzes

``Method: GET``

``Path: /users/quiz/all``

``Authorization: Not required``

```Description: Retrieves a list of all available quizzes.```
Response: Array of quiz objects (JSON)

### Get Generated Quiz

``Method: GET``

``Path: /users/quiz``

``Authorization: Required (Bearer token)``

``Description: Retrieves a generated quiz for the authenticated user.``
``Response: Quiz object (JSON)``



### Submit Quiz Answers

``Method: POST``

``Path: /users/quiz/{quizId}/answers``

``Content-Type: application/json``

``Authorization: Required (Bearer token)``

``Description: Submits quiz answers and returns analysis.``

_Request Body:{
  "quizId": number,
  "answers": [
    {
      "questionIndex": number,
      "answers": "string"
    }
  ]
}_


Response: Analysis of submitted answers (JSON)

Generate User Profile from Quiz

_Method: POST
Path: /users/quiz/{quizId}/generate-profile

Content-Type: application/json

Authorization: Required (Bearer token)_

Description: Generates a user profile based on quiz answers.

___Request Body:{
  "quizId": number,
  "answers": [
    {
      "questionIndex": number,
      "answers": "string"
    }
  ]
}___


Response: Generated user profile (JSON)

External API
Check Available GPT Models

## 