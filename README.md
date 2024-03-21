### Serverless REST Assignment
---
# Name: Ilia Tokarev 

# Video demonstration: https://youtu.be/91CZvwHnQBQ

# API endpoints: <br>
- POST /prod/reviews - add a new review (need a token) <br>
- GET /prod/movies/{movieId}/reviews - get a movie review by id (don't need a token) <br>
- GET /prod/movies/{movieId}/reviews?minRating=n - get movie reviews by id where Rating >=minRating (don't need a token) <br>
- GET /prod/movies/{movieId}/reviews?year=n - get movie reviews by id where Rating >=minRating (don't need a token) <br>
- GET /prod/movies/{movieId}/reviews/{reviewerName} - get a moview review by id where ReviewerName=reviewerName (don't need a token) <br>
- PUT /prod/movies/{movieId}/reviews/{reviewerName} - put a moview review content (need a token) <br>
- DELETE /prod/movies/{movieId}/reviews/{reviewerName} - delete a moview review by id and reviewerName (need a token) <br>
- GET /prod/reviews/{reviewerName} - get all reviews by reviewerName (don't need a token) <br>

![image](https://github.com/Tokarev-IP/webproject/assets/61622665/ccfcf610-43d7-44de-97a8-58d8c78b9d3a)

![image](https://github.com/Tokarev-IP/webproject/assets/61622665/98cdf424-4d3d-400f-b57a-5812433cc92d)

![image](https://github.com/Tokarev-IP/webproject/assets/61622665/5527dafc-d823-49f1-ac14-ca39ba9d7512)


# Authentication: <br>
- POST /prod/auth/signup - SignUp function <br>
- POST /prod/auth/confirm_signup - Confirm SignUp action <br>
- POST /prod/auth/signin - SignIn for getting token for Authorization functionality <br>
- GET /prod/auth/signout - SignOut function <br>

![image](https://github.com/Tokarev-IP/webproject/assets/61622665/a77f33df-cbf9-4430-9555-736846468977)

![image](https://github.com/Tokarev-IP/webproject/assets/61622665/7a1f60f2-324b-43e0-a9a9-ebe2c9d84771)
