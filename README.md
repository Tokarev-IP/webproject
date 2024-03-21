Ilia Tokarev 

video: https://youtu.be/91CZvwHnQBQ

This project consist of:

MovieReview database - these db consists of data of reviews for any movie

"AuthServiceApi" Cognito Authentication endpoints: <br>
- POST /prod/auth/signup - SignUp function <br>
- POST /prod/auth/confirm_signup - Confirm SignUp action <br>
- POST /prod/auth/signin - SignIn for getting token for Authorization functionality <br>
- GET /prod/auth/signout - SignOut function <br>

"AppApi" API endpoints: <br>
- POST /prod/reviews - add a new review (need a token) <br>
- GET /prod/movies/{movieId}/reviews - get a movie review by id (don't need a token) <br>
- GET /prod/movies/{movieId}/reviews?minRating=n - get movie reviews by id where Rating >=minRating (don't need a token) <br>
- GET /prod/movies/{movieId}/reviews?year=n - get movie reviews by id where Rating >=minRating (don't need a token) <br>
- GET /prod/movies/{movieId}/reviews/{reviewerName} - get a moview review by id where ReviewerName=reviewerName (don't need a token) <br>
- PUT /prod/movies/{movieId}/reviews/{reviewerName} - put a moview review content (need a token) <br>
- DELETE /prod/movies/{movieId}/reviews/{reviewerName} - delete a moview review by id and reviewerName (need a token) <br>
- GET /prod/reviews/{reviewerName} - get all reviews by reviewerName (don't need a token) <br>

To get a token it is necessery to SignIn (if a user didn't SignUp before, it is needed to SignUp and confirm it using email address).

Picture of APIs:
![image](https://github.com/Tokarev-IP/webproject/assets/61622665/ccfcf610-43d7-44de-97a8-58d8c78b9d3a)


Pictures of AppAPI:
![image](https://github.com/Tokarev-IP/webproject/assets/61622665/98cdf424-4d3d-400f-b57a-5812433cc92d)

![image](https://github.com/Tokarev-IP/webproject/assets/61622665/5527dafc-d823-49f1-ac14-ca39ba9d7512)

Picture of AuthAPI:
![image](https://github.com/Tokarev-IP/webproject/assets/61622665/a77f33df-cbf9-4430-9555-736846468977)


Picture of user in Cognito:
![image](https://github.com/Tokarev-IP/webproject/assets/61622665/7a1f60f2-324b-43e0-a9a9-ebe2c9d84771)
