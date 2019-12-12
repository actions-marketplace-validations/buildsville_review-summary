import * as core from '@actions/core'
import * as github from '@actions/github'
import * as octokit from '@octokit/rest'

type Reviews = octokit.PullsListReviewsResponseItem & {
    submitted_at: string
}

type Status = {
    state: string
    user: string
    submitted_at: number
}

type Result = {
    approved: string
    commented: string
    changes_requested: string
    pending: string
}

async function getReview():Promise<octokit.Response<Reviews[]>> {
    let payload = github.context.payload
    let pullRequest = payload.pull_request 
    let repository = payload.repository
    if ( pullRequest == undefined || repository == undefined ) {
        return
    }
    let owner = repository.owner.login
    let pullNumber = pullRequest.number
    let repo = repository.name
    let client = new github.GitHub(core.getInput('token'))
    let result = await client.pulls.listReviews({
        owner: owner,
        pull_number: pullNumber,
        repo: repo
    }).catch(
        e => core.setFailed(e.message)
    ) as octokit.Response<Reviews[]>
    return result
}

function summary(review: octokit.Response<Reviews[]>):Array<string> {
    let data = review.data
    let summary = data.map(
        d => <Status>{
            state: d.state,
            user: d.user.login,
            submitted_at: Date.parse(d.submitted_at)
        }
    )

    let eachUser = {}
    let states = []

    summary.forEach( s => {
        if (!eachUser[s.user]) {
            eachUser[s.user] = {
                state: s.state,
                time: s.submitted_at
            }
        } else {
            if(eachUser[s.user].time < s.submitted_at ) {
                eachUser[s.user] = {
                    state: s.state,
                    time: s.submitted_at
                }
            }
        }
    })

    Object.keys(eachUser).forEach( u => {
        states.push(eachUser[u].state)
    })
    return states
}

function aggregate(arr: Array<string>):Result {
    let approve = arr.filter(
        s => s == "APPROVED"
    ).length
    let requestCanges = arr.filter(
        s => s == "CHANGES_REQUESTED"
    ).length
    let comment = arr.filter(
        s => s == "COMMENTED"
    ).length
    let pending = arr.filter(
        s => s == "PENDING"
    ).length
    let result: Result = {
        approved: approve.toString(),
        commented: comment.toString(),
        changes_requested: requestCanges.toString(),
        pending: pending.toString()
    }
    return result
}

function output(result: Result):void{
    core.setOutput('approved',result.approved)
    core.setOutput('changes_requested',result.changes_requested)
    core.setOutput('commented',result.commented)
    core.setOutput('pending',result.pending)
}

const reviews:Promise<octokit.Response<Reviews[]>> = getReview()
reviews.then(function(rev){
    const sum = summary(rev)
    const agg = aggregate(sum)
    output(agg)
})
