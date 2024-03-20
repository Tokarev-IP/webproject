Ilia Tokarev

video: 

This project consist of:
MovieReview database - these db consists of data of reviews for any movie

"AuthServiceApi" Cognito Authentication endpoints:
POST /prod/auth/signup - SignUp function
POST /prod/auth/confirm_signup - Confirm SignUp action
POST /prod/auth/signin - SignIn for getting token for Authorization functionality
GET /prod/auth/signout - SignOut function

"AppApi" API endpoints:
POST /prod/reviews - add a new review (need a token)
GET /prod/movies/{movieId}/reviews - get a movie review by id (don't need a token)
GET /prod/movies/{movieId}/reviews?minRating=n - get movie reviews by id where Rating >=minRating (don't need a token)
GET /prod/movies/{movieId}/reviews?year=n - get movie reviews by id where Rating >=minRating (don't need a token)
GET /prod/movies/{movieId}/reviews/{reviewerName} - get a moview review by id where ReviewerName=reviewerName (don't need a token)
PUT /prod/movies/{movieId}/reviews/{reviewerName} - put a moview review content (need a token)
GET /prod/reviews/{reviewerName} - get all reviews by reviewerName (don't need a token)

To get a token it is necessery to SignIn (if a user didn't SignUp before, it is needed to SignUp and confirm it using email address).
